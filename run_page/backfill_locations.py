import argparse
import json
import time

import polyline

from config import JSON_FILE, SQL_FILE
from generator import Generator
from generator.db import init_db, reverse_geocode_location, Activity


class Point:
    def __init__(self, lat, lon):
        self.lat = lat
        self.lon = lon


def backfill_locations(delay_seconds=0.3):
    session = init_db(SQL_FILE)
    missing = (
        session.query(Activity)
        .filter(
            (Activity.location_country.is_(None)) | (Activity.location_country == "")
        )
        .filter(Activity.summary_polyline.is_not(None))
        .filter(Activity.summary_polyline != "")
        .all()
    )
    print(f"Found {len(missing)} activities with missing locations", flush=True)
    updated = 0
    for idx, activity in enumerate(missing, start=1):
        try:
            points = polyline.decode(activity.summary_polyline)
            if not points:
                print(
                    f"[{idx}/{len(missing)}] skip run_id={activity.run_id}: no polyline points",
                    flush=True,
                )
                continue
            lat, lon = points[0]
            location = reverse_geocode_location(Point(lat, lon))
            if not location:
                print(
                    f"[{idx}/{len(missing)}] skip run_id={activity.run_id}: no location result",
                    flush=True,
                )
                continue
            activity.location_country = location
            updated += 1
            print(
                f"[{idx}/{len(missing)}] backfilled run_id={activity.run_id}",
                flush=True,
            )
            time.sleep(delay_seconds)
        except Exception as exc:
            print(f"skip run_id={activity.run_id}: {exc}", flush=True)
    session.commit()
    generator = Generator(SQL_FILE)
    activities_list = generator.load()
    with open(JSON_FILE, "w") as f:
        json.dump(activities_list, f)
    print(f"Backfilled {updated} activities", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--delay-seconds",
        type=float,
        default=0.3,
        help="delay between reverse geocoding requests",
    )
    options = parser.parse_args()
    backfill_locations(delay_seconds=options.delay_seconds)
