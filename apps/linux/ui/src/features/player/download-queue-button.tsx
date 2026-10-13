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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { DownloadQueue } from "./download-queue";

export function DownloadQueueButton() {
  return (
    <Dialog>
      <Tooltip>
        <TooltipTrigger
          render={
            <DialogTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-lg"
                  className="size-12 rounded-xl text-muted-foreground outline-none hover:bg-card hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                  aria-label="التنزيلات"
                />
              }
            />
          }
        >
          <Download className="size-6 stroke-[1.65]" data-icon="inline-start" aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent side="left">التنزيلات على هذا الجهاز</TooltipContent>
      </Tooltip>
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
