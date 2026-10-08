import AuthGate from "@/components/AuthGate";
import MovementFlow from "@/components/MovementFlow";
import { CK_ROLES } from "@/lib/roles";

export default function StockOutPage() {
  return (
    <AuthGate allow={CK_ROLES}>
      <MovementFlow type="out" />
    </AuthGate>
  );
}
