import { DashboardLayout } from './components/layout/DashboardLayout';
import {
  AdminOverviewSection,
  AdminClassesSection,
  AdminLedgerSection,
} from './features/admin/AdminView';
import { SessionsManagement } from './features/sessions/SessionsManagement';
import { MyApplications } from './features/applications/MyApplications';
import { ClassList } from './features/classes/ClassList';
import { useMyHolds } from './hooks/useAdmissions';
import { useSeatOfferAlerts } from './hooks/useSeatOfferAlerts';
import { useAppStore, type Tab } from './store/useAppStore';

const views: Record<Tab, () => JSX.Element> = {
  classes: ClassList,
  applications: MyApplications,
  admin: AdminOverviewSection,
  'admin-overview': AdminOverviewSection,
  'admin-classes': AdminClassesSection,
  'admin-sessions': SessionsManagement,
  'admin-ledger': AdminLedgerSection,
};

export function App() {
  const tab = useAppStore((s) => s.tab);
  const holds = useMyHolds();
  useSeatOfferAlerts(holds.data);

  const View = views[tab] ?? ClassList;

  return (
    <DashboardLayout>
      <View />
    </DashboardLayout>
  );
}
