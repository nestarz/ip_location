import { router } from "rutt";
import createGeoLocationFromIp from "ip_location";
import geoLookup from "ip_location/geolookup.ts";

const geoLocationFromIp = createGeoLocationFromIp(Deno.env.get("MAXMIND_KEY")!);

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
        })
      );
    },
    "POST@/ip{/}?": async (req: Request) => {
      const { ip } = await req.json();
      return new Response(
        JSON.stringify({
          data: await geoLocationFromIp(ip),
        })
      );
    },
  })
).finished;
