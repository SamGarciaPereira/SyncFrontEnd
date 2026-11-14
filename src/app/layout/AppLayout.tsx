import { Outlet } from "react-router-dom";
import { Waves } from "../components/Waves";
import { Sidebar } from "./Sidebar";
import { MobileHeader } from "./MobileHeader";
import { BottomNav } from "./BottomNav";
import { ProfileMenu } from "./ProfileMenu";
import { AlarmProvider } from "../alarm/AlarmProvider";

/** Responsive shell: sidebar on desktop, header + bottom tabs on mobile. */
export function AppLayout() {
  return (
    <AlarmProvider>
      <div className="app-shell flex min-h-svh">
      <Sidebar />

      <div className="flex min-h-svh min-w-0 flex-1 flex-col">
        <MobileHeader />

        {/* Desktop top band with profile avatar */}
        <div className="relative z-30 hidden lg:block">
          <div className="h-20 rounded-bl-[2.5rem] bg-linear-to-r from-sage/50 via-cream-deep to-cream-deep" />
          <div className="absolute right-8 top-1/2 z-30 -translate-y-1/2">
            <ProfileMenu variant="desktop" />
          </div>
        </div>

        <main className="relative flex-1 overflow-hidden">
          <div className="relative z-10 mx-auto w-full max-w-4xl px-5 pb-28 pt-7 lg:px-10 lg:py-8">
            <Outlet />
          </div>
          <Waves variant="light" className="absolute inset-x-0 bottom-0 z-0 h-24 opacity-90 lg:h-32" />
        </main>

        <BottomNav />
      </div>
      </div>
    </AlarmProvider>
  );
}
