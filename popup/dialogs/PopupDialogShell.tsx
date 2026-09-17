import type { ReactNode } from 'react';
import { Dialog, Modal, ModalOverlay } from 'react-aria-components';

export function PopupDialogShell({ children, onDismiss }: { children: ReactNode; onDismiss: () => void }) {
  return (
    <ModalOverlay
      isOpen
      isDismissable
      onOpenChange={(open) => {
        if (!open) onDismiss();
      }}
      className="fixed inset-x-0 top-0 bottom-14 z-50 bg-black/40 backdrop-blur-sm"
    >
      <Modal className="absolute top-1/2 left-1/2 w-[calc(100%-2.5rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-current bg-primary text-primary shadow-2xl">
        <Dialog className="p-6 outline-none">{children}</Dialog>
      </Modal>
    </ModalOverlay>
  );
}
