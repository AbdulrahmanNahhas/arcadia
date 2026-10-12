import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { DownloadQueue } from "./download-queue";

export function DownloadQueueButton() {
  return (
    <Dialog>
      <DialogTrigger
        render={<Button variant="ghost" size="icon-lg" aria-label="التنزيلات" title="التنزيلات" />}
      >
        <Download data-icon="inline-start" />
      </DialogTrigger>
      <DialogContent
        className="flex max-h-5/6 w-11/12 flex-col sm:max-w-2xl"
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle>التنزيلات على هذا الجهاز</DialogTitle>
          <DialogDescription>التقدم وحالة الحفظ والإيقاف والاستئناف.</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto overscroll-contain">
          <DownloadQueue />
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>إغلاق</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
