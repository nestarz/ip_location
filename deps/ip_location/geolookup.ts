import * as turfHelpers from "https://esm.sh/@turf/helpers@6.5.0";
import turfNearestPoint from "https://esm.sh/@turf/nearest-point@6.5.0";
import cities500 from "./cities500.json" assert { type: "json" };

type GeoNameId = "number";
type CityName = "string";
type CountryCode = "string";
type AdminCode = "string";
type Latitude = "number";
type Longitude = "number";
export type GeoNamePoint = [
  CityName,
  CountryCode,
  AdminCode,
  Latitude,
  Longitude
];

const values: GeoNamePoint[] = Object.values(cities500);
const points = turfHelpers.featureCollection(
  values.map((point) => turfHelpers.point([point[3], point[4]]))
);

export default () =>
  (longitude: number, latitude: number): GeoNamePoint | null => {
    const idx = turfNearestPoint(
      turfHelpers.point([longitude, latitude]),
      points
    )?.properties?.featureIndex;
    return idx ? values[idx] : null;
  };
