import { useSchoolConfig } from '@/hooks/useSchoolConfig';
import schoolLogo from '@/assets/school-logo.png';

export function SchoolWatermark() {
  const { data: config } = useSchoolConfig();
  const logoSrc = config?.logo_url || schoolLogo;

  return (
    <div className="fixed inset-0 z-0 pointer-events-none flex items-center justify-center overflow-hidden">
      <img
        src={logoSrc}
        alt=""
        className="w-[60vw] max-w-[500px] h-auto opacity-[0.04] select-none"
        draggable={false}
      />
    </div>
  );
}
