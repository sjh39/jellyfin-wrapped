import EmptyState from "../EmptyState";
import { useErrorBoundary } from "react-error-boundary";
import { useDeviceStats } from "@/hooks/queries/useDeviceStats";
import { LoadingSpinner } from "../LoadingSpinner";
import { PieChart } from "../charts/PieChart";
import PageContainer from "../PageContainer";
import { Panel, Slide } from "../wrapped/Slide";

export default function DeviceStatsPage() {
  const { showBoundary } = useErrorBoundary();
  const { data: deviceStats, isLoading, error } = useDeviceStats();

  if (error) {
    showBoundary(error);
  }

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!deviceStats) {
    return <EmptyState title="No device stats" />;
  }

  const deviceData = deviceStats.deviceUsage.map(
    (d: { deviceName: string; minutes: number }) => ({
      name: d.deviceName,
      minutes: d.minutes,
    })
  );
  const browserData = deviceStats.browserUsage.map(
    (d: { browserName: string; minutes: number }) => ({
      name: d.browserName,
      minutes: d.minutes,
    })
  );
  const osData = deviceStats.osUsage.map(
    (d: { osName: string; minutes: number }) => ({
      name: d.osName,
      minutes: d.minutes,
    })
  );

  return (
    <PageContainer>
      <Slide
        title="Your viewing devices"
        sub="Where you watch your content across different devices and apps"
      >
        <Panel title="Devices">
          <PieChart data={deviceData} title="Devices" />
        </Panel>
        <Panel title="Browsers">
          <PieChart data={browserData} title="Browsers" />
        </Panel>
        <Panel title="Operating systems">
          <PieChart data={osData} title="Operating systems" />
        </Panel>
      </Slide>
    </PageContainer>
  );
}
