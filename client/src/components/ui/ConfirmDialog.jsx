import { Modal, Text, Group, Button } from '@mantine/core';

/**
 * ConfirmModal — delete/action confirmation dialog.
 * danger prop turns the confirm button red.
 * Replaces old ConfirmDialog (same prop names kept for backward compat).
 */
export default function ConfirmDialog({
  open,
  onConfirm,
  onCancel,
  title = 'Are you sure?',
  message,
  isDangerous = false,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isLoading = false,
  // Pass a value above 200 (Mantine's default modal z-index) when this confirm
  // must appear on top of another already-open modal.
  zIndex,
}) {
  return (
    <Modal
      opened={open}
      onClose={onCancel}
      title={title}
      size="sm"
      centered
      zIndex={zIndex}
    >
      {message && (
        <Text size="sm" c="dimmed" mb="lg" role={isDangerous ? 'alert' : undefined}>
          {message}
        </Text>
      )}
      <Group justify="flex-end" gap="sm">
        <Button variant="default" onClick={onCancel} disabled={isLoading}>
          {cancelText}
        </Button>
        <Button
          color={isDangerous ? 'red' : 'blue'}
          loading={isLoading}
          onClick={onConfirm}
        >
          {confirmText}
        </Button>
      </Group>
    </Modal>
  );
}
