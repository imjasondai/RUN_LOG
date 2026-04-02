import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import Layout from '@/components/Layout';
import RunPolyline from '@/components/RunPolyline';
import RunMap from '@/components/RunMap';
import RunDetailPanel from '@/components/RunDetailPanel';
import useActivities from '@/hooks/useActivities';
import NotFound from '@/pages/404';
import { geoJsonForRuns, getBoundsForGeoData, isRun, IViewState } from '@/utils/utils';

const RunDetail = () => {
  const { runId } = useParams();
  const runIdNumber = Number(runId);
  const { activities } = useActivities();

  const run = useMemo(() => {
    if (!runId || Number.isNaN(runIdNumber)) return null;
    return activities.find((r) => r.run_id === runIdNumber) ?? null;
  }, [activities, runId, runIdNumber]);

  const monthlyDistanceKm = useMemo(() => {
    if (!run?.start_date_local) return 0;
    const yearMonth = run.start_date_local.slice(0, 7);
    const monthDistance = activities.reduce((sum, activity) => {
      if (!isRun(activity.type)) return sum;
      if (activity.start_date_local.slice(0, 7) !== yearMonth) return sum;
      return sum + activity.distance;
    }, 0);
    return monthDistance / 1000;
  }, [activities, run]);

  const geoData = useMemo(() => geoJsonForRuns(run ? [run] : []), [run]);
  const [viewState, setViewState] = useState<IViewState>(
    run ? getBoundsForGeoData(geoData) : {}
  );

  useEffect(() => {
    if (run) {
      setViewState(getBoundsForGeoData(geoData));
    }
  }, [geoData, run]);

  if (!runId || Number.isNaN(runIdNumber) || !run) {
    return <NotFound />;
  }

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  }, []);

  return (
    <Layout>
      <div className="max-w-[480px] mx-auto">
        <div className="rounded-card overflow-hidden border border-gray-800/50 min-h-[320px] h-[360px] mb-6">
          <RunMap
            viewState={viewState}
            geoData={geoData}
            setViewState={setViewState}
            changeYear={() => {}}
            thisYear={run.start_date_local.slice(0, 4)}
          />
        </div>
        <div className="flex justify-center items-center mb-6">
          <RunPolyline run={run} className="w-[220px] h-[220px]" />
        </div>
        <RunDetailPanel run={run} monthlyDistanceKm={monthlyDistanceKm} />
      </div>
    </Layout>
  );
};

export default RunDetail;
