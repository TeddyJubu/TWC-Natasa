// The lazy chat, as the main typecheck sees it. Its real types are checked by tsconfig.eve.json.
declare module "@eve-chat" {
  import type { ComponentType } from "react";
  const EveChat: ComponentType<{ onClose: () => void }>;
  export default EveChat;
}
