import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { SLOT_LABEL } from "@/lib/catalog";
import type { Gap } from "@/lib/types";

export function MissingModal({
  open,
  message,
  gaps,
  onUpload,
  onSkip,
  onCancel,
}: {
  open: boolean;
  message: string;
  gaps: Gap[];
  onUpload: () => void;
  onSkip: () => void;
  onCancel: () => void;
}) {
  const required = gaps.some((g) => g.severity === "required");
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent>
        <DialogTitle>Thiếu dữ liệu</DialogTitle>
        <DialogDescription>{message}</DialogDescription>
        <ul className="mt-4 space-y-1 text-sm text-muted">
          {gaps.map((g) => (
            <li key={g.slot + g.severity}>
              {SLOT_LABEL[g.slot]} — {g.severity === "required" ? "bắt buộc" : "khuyên dùng"}
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onCancel}>
            Hủy
          </Button>
          {!required ? (
            <Button variant="outline" onClick={onSkip}>
              Bỏ qua, chạy với data hiện có
            </Button>
          ) : null}
          <Button onClick={onUpload}>Upload thêm</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
