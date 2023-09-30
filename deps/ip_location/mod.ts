import {
  assertExists,
  assertStrictEquals,
} from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { Untar } from "https://deno.land/std@0.190.0/archive/untar.ts";
import {
  readerFromStreamReader,
  iterateReader,
} from "https://deno.land/std@0.190.0/streams/mod.ts";
import { Maxmind } from "https://deno.land/x/maxminddb@v1.2.0/mod.ts";
import cities500 from "./cities500.json" assert { type: "json" };
import type { GeoNamePoint } from "./geolookup.ts";
import type { S3Client } from "https://deno.land/x/s3_lite_client@0.6.1/mod.ts";

async function gen2array<T>(gen: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const x of gen) out.push(x);
  return out;
}

const merge = (tArrs: Uint8Array[], type = Uint8Array) => {
  const ret = new type(tArrs.reduce((acc, tArr) => acc + tArr.byteLength, 0));
  let off = 0;
  tArrs.forEach((tArr) => {
    ret.set(tArr, off);
    off += tArr.byteLength;
  });
  return ret;
};

const getFromTar = async (
  streamReader: ReadableStreamDefaultReader<Uint8Array>
) => {
  const untar = new Untar(readerFromStreamReader(streamReader));
  for await (const entry of untar)
    if (entry.fileName.endsWith("GeoLite2-City.mmdb"))
      return merge(await gen2array(iterateReader(entry)));
};

const createDatabase = async (s3Client: S3Client, key: string) => {
  const cacheStream = await s3Client
    ?.getObject("maxmind.bin")
    .then((r) => r.arrayBuffer())
    .catch(() => null);
  if (cacheStream) {
    console.log("[maxmind] use cache database");
    return new Maxmind(new Uint8Array(cacheStream));
  }
  const url = `https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-City&license_key=${key}&suffix=tar.gz`;
  const res = await fetch(url);
  assertStrictEquals(res.status, 200);
  assertExists(res.body);
  const streamReader = res.body
    .pipeThrough(new DecompressionStream("gzip"))
    .getReader();
  const bytes = await getFromTar(streamReader);
  if (!bytes) return null;
  await s3Client.putObject("maxmind.bin", bytes);
  return new Maxmind(bytes);
};

let dbPromise;
export default ({
    maxmindKey,
    s3Client,
  }: {
    maxmindKey: string;
    s3Client: S3Client;
  }) =>
  async (ip: string) => {
    if (ip === "127.0.0.1") return null;
    try {
      console.time("[maxmind] create database");
      dbPromise ??= createDatabase(s3Client, maxmindKey);
      const db = await dbPromise;
      console.timeEnd("[maxmind] create database");
      console.log(ip);
      const geoname_id: string = db.lookup_city(ip)?.city.geoname_id.toString();
      const point = (cities500 as any)[geoname_id] as GeoNamePoint;
      return point
        ? {
            city_name: point[0] as string,
            country_code: point[1] as string,
            region_code: point[2] as string,
            latitude: point[3] as unknown as number,
            longitude: point[4] as unknown as number,
          }
        : null;
    } catch (error) {
      console.error(error);
      return null;
    }
  };
