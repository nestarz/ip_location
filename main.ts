import { router } from "rutt";
import createGeoLocationFromIp from "ip_location";
import createGeoLookup from "ip_location/geolookup.ts";
import { S3Client } from "s3_lite_client";

const s3Client = new S3Client({
  accessKey: Deno.env.get("S3_ACCESS_KEY_ID")!,
  secretKey: Deno.env.get("S3_SECRET_ACCESS_KEY")!,
  endPoint: Deno.env.get("S3_ENDPOINT_URL")!,
  region: Deno.env.get("S3_BUCKET_REGION")!,
  bucket: Deno.env.get("S3_DEFAULT_BUCKET")!,
  useSSL: true,
  pathStyle: true,
});

const geoLookup = createGeoLookup();
const geoLocationFromIp = createGeoLocationFromIp({
  maxmindKey: Deno.env.get("MAXMIND_KEY")!,
  s3Client,
});

const map = { "91.172.211.149": "37.65.173.13" };

await Deno.serve(
  { port: 1001 },
  router({
    "POST@/lookup{/}?": async (req: Request) => {
      const { latitude, longitude } = await req.json();
      return new Response(
        JSON.stringify({
          data: [latitude, longitude].every((d) => typeof d === "number")
            ? await geoLookup(latitude, longitude)
            : undefined,
        }),
      );
    },
    "POST@/ip{/}?": async (req: Request) => {
      const { ip } = await req.json();
      const ipOrfakeIp = ip in map ? map[ip as keyof typeof map] : ip;
      if (ip !== ipOrfakeIp) console.warn("using fake ip for", ip, ipOrfakeIp);
      return new Response(
        JSON.stringify({
          data: await geoLocationFromIp(ipOrfakeIp),
        }),
      );
    },
  }),
).finished;
