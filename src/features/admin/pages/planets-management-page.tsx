import { ArrowLeftIcon, FloppyDiskIcon, PlusIcon, SwapIcon } from "@phosphor-icons/react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { type FormEvent, useMemo, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { PlanetWithWorks } from "@/features/platform/model";
import {
  getAdminPlanets,
  getAdminUnassignedPlanetWorks,
  moveAdminWorksToPlanet,
  saveAdminPlanet,
} from "@/server/platform.functions";
import { AdminPageHeader } from "../components/admin-page-header";

type PlanetDraft = Omit<PlanetWithWorks, "id" | "works" | "workCount" | "reviewCount"> & {
  id?: string;
};

const unassignedSourceId = "__unassigned__";

function draftFromPlanet(planet?: PlanetWithWorks): PlanetDraft {
  return {
    id: planet?.id,
    slug: planet?.slug ?? "",
    nameAr: planet?.nameAr ?? "",
    nameEn: planet?.nameEn ?? null,
    icon: planet?.icon ?? "🪐",
    description: planet?.description ?? "",
    primaryColor: planet?.primaryColor ?? "#7189E8",
    secondaryColor: planet?.secondaryColor ?? "#29355F",
    displayOrder: planet?.displayOrder ?? 100,
    isActive: planet?.isActive ?? true,
  };
}

export function PlanetsManagementPage() {
  const queryClient = useQueryClient();
  const { data: planets } = useSuspenseQuery({
    queryKey: ["admin-planets"],
    queryFn: () => getAdminPlanets(),
  });
  const { data: unassignedWorks } = useSuspenseQuery({
    queryKey: ["admin-unassigned-planet-works"],
    queryFn: () => getAdminUnassignedPlanetWorks(),
  });
  const [draft, setDraft] = useState<PlanetDraft>(() => draftFromPlanet(planets[0]));
  const [sourceId, setSourceId] = useState(unassignedSourceId);
  const [targetId, setTargetId] = useState(planets.find((planet) => planet.isActive)?.id ?? "");
  const [selectedWorks, setSelectedWorks] = useState<Set<string>>(new Set());
  const source = planets.find((planet) => planet.id === sourceId);
  const sourceWorks = sourceId === unassignedSourceId ? unassignedWorks : (source?.works ?? []);
  const planetItems = useMemo(
    () => planets.map((planet) => ({ value: planet.id, label: planet.nameAr })),
    [planets],
  );
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin-planets"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-unassigned-planet-works"] }),
      queryClient.invalidateQueries({ queryKey: ["planets"] }),
      queryClient.invalidateQueries({ queryKey: ["platform-home"] }),
    ]);
  };
  const saveMutation = useMutation({
    mutationFn: saveAdminPlanet,
    onSuccess: async (saved) => {
      await refresh();
      if (saved) setDraft(draftFromPlanet(saved));
    },
  });
  const moveMutation = useMutation({
    mutationFn: moveAdminWorksToPlanet,
    onSuccess: async () => {
      setSelectedWorks(new Set());
      await refresh();
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    saveMutation.mutate({ data: draft });
  };

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <AdminPageHeader
        title="إدارة الكواكب"
        description="أنشئ الكواكب وعدّل هويتها وترتيبها، ثم انقل الأعمال بينها بإسناد أساسي واحد."
        actions={
          <Button variant="outline" onClick={() => setDraft(draftFromPlanet())}>
            <PlusIcon data-icon="inline-start" /> كوكب جديد
          </Button>
        }
      />
      <div className="grid min-w-0 gap-6 xl:grid-cols-[18rem_minmax(0,1fr)] p-6 pt-0 pr-4">
        <Card>
          <CardHeader>
            <CardTitle>الكواكب</CardTitle>
            <CardDescription>{planets.length} سجل بيانات</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            {planets.map((planet) => (
              <button
                key={planet.id}
                type="button"
                onClick={() => setDraft(draftFromPlanet(planet))}
                className="flex items-center gap-3 rounded-lg p-2 text-start transition-colors hover:bg-muted"
                data-active={draft.id === planet.id}
              >
                <span
                  className="flex size-9 items-center justify-center rounded-full border"
                  style={{ borderColor: planet.primaryColor }}
                >
                  {planet.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-sm font-medium">{planet.nameAr}</strong>
                  <span className="text-xs text-muted-foreground">{planet.workCount} عمل</span>
                </span>
                {!planet.isActive && <Badge variant="outline">معطّل</Badge>}
              </button>
            ))}
          </CardContent>
        </Card>
        <Card>
          <form onSubmit={submit}>
            <CardHeader>
              <CardTitle>{draft.id ? "تحرير الكوكب" : "إضافة كوكب"}</CardTitle>
              <CardDescription>
                المعرّف الداخلي يبقى ثابتاً؛ الرابط يعتمد على slug فريد.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-6">
              <FieldGroup>
                <div className="grid gap-4 sm:grid-cols-[5rem_1fr_1fr]">
                  <Field>
                    <FieldLabel htmlFor="planet-icon">الرمز</FieldLabel>
                    <Input
                      id="planet-icon"
                      value={draft.icon}
                      onChange={(event) => setDraft({ ...draft, icon: event.target.value })}
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="planet-name-ar">الاسم العربي</FieldLabel>
                    <Input
                      id="planet-name-ar"
                      value={draft.nameAr}
                      onChange={(event) => setDraft({ ...draft, nameAr: event.target.value })}
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="planet-name-en">الاسم الإنجليزي</FieldLabel>
                    <Input
                      id="planet-name-en"
                      value={draft.nameEn ?? ""}
                      onChange={(event) =>
                        setDraft({ ...draft, nameEn: event.target.value || null })
                      }
                      dir="ltr"
                    />
                  </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="planet-slug">Slug</FieldLabel>
                    <Input
                      id="planet-slug"
                      value={draft.slug}
                      onChange={(event) => setDraft({ ...draft, slug: event.target.value })}
                      pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                      required
                      dir="ltr"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="planet-order">ترتيب العرض</FieldLabel>
                    <Input
                      id="planet-order"
                      type="number"
                      min={0}
                      value={draft.displayOrder}
                      onChange={(event) =>
                        setDraft({ ...draft, displayOrder: Number(event.target.value) })
                      }
                    />
                  </Field>
                </div>
                <Field>
                  <FieldLabel htmlFor="planet-description">الوصف</FieldLabel>
                  <Textarea
                    id="planet-description"
                    value={draft.description}
                    onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                    rows={3}
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="planet-primary">اللون الأساسي</FieldLabel>
                    <div className="flex gap-2">
                      <Input
                        id="planet-primary"
                        type="color"
                        value={draft.primaryColor}
                        onChange={(event) =>
                          setDraft({ ...draft, primaryColor: event.target.value })
                        }
                        className="w-14"
                      />
                      <Input
                        value={draft.primaryColor}
                        onChange={(event) =>
                          setDraft({ ...draft, primaryColor: event.target.value })
                        }
                        dir="ltr"
                        aria-label="قيمة اللون الأساسي"
                      />
                    </div>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="planet-secondary">اللون الثانوي</FieldLabel>
                    <div className="flex gap-2">
                      <Input
                        id="planet-secondary"
                        type="color"
                        value={draft.secondaryColor}
                        onChange={(event) =>
                          setDraft({ ...draft, secondaryColor: event.target.value })
                        }
                        className="w-14"
                      />
                      <Input
                        value={draft.secondaryColor}
                        onChange={(event) =>
                          setDraft({ ...draft, secondaryColor: event.target.value })
                        }
                        dir="ltr"
                        aria-label="قيمة اللون الثانوي"
                      />
                    </div>
                  </Field>
                </div>

                <Field orientation="horizontal">
                  <Switch
                    id="planet-active"
                    checked={draft.isActive}
                    onCheckedChange={(checked) => setDraft({ ...draft, isActive: checked })}
                  />
                  <FieldLabel htmlFor="planet-active">نشط في المنصة الرئيسية</FieldLabel>
                </Field>
                {saveMutation.error && (
                  <Alert variant="destructive">
                    <AlertDescription>{saveMutation.error.message}</AlertDescription>
                  </Alert>
                )}
              </FieldGroup>
            </CardContent>
            <CardFooter className="flex items-center justify-end">
              <Button type="submit" disabled={saveMutation.isPending}>
                <FloppyDiskIcon data-icon="inline-start" />{" "}
                {saveMutation.isPending ? "جارٍ الحفظ…" : "حفظ الكوكب"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
      <Card className="m-6 -mt-6 mr-4">
        <CardHeader>
          <CardTitle>نقل الأعمال بين الكواكب</CardTitle>
          <CardDescription>النقل يحدّث الإسناد الأساسي نفسه؛ لا ينشئ علاقة ثانية.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr_auto]">
            <Field>
              <FieldLabel htmlFor="planet-source">من</FieldLabel>
              <Select
                items={[{ value: unassignedSourceId, label: "أعمال بلا كوكب" }, ...planetItems]}
                value={sourceId}
                onValueChange={(value) => {
                  setSourceId(value ?? "");
                  setSelectedWorks(new Set());
                }}
              >
                <SelectTrigger id="planet-source" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value={unassignedSourceId}>أعمال بلا كوكب</SelectItem>
                    {planetItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <ArrowLeftIcon className="hidden self-end sm:block" />
            <Field>
              <FieldLabel htmlFor="planet-target">إلى</FieldLabel>
              <Select
                items={planetItems.filter(
                  (item) => planets.find((planet) => planet.id === item.value)?.isActive,
                )}
                value={targetId}
                onValueChange={(value) => setTargetId(value ?? "")}
              >
                <SelectTrigger id="planet-target" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {planetItems
                      .filter(
                        (item) =>
                          item.value !== sourceId &&
                          planets.find((planet) => planet.id === item.value)?.isActive,
                      )
                      .map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Button
              className="self-end"
              disabled={
                !selectedWorks.size || !targetId || targetId === sourceId || moveMutation.isPending
              }
              onClick={() =>
                moveMutation.mutate({ data: { workIds: [...selectedWorks], planetId: targetId } })
              }
            >
              <SwapIcon data-icon="inline-start" /> نقل {selectedWorks.size || ""}
            </Button>
          </div>
          {moveMutation.error && (
            <Alert variant="destructive">
              <AlertDescription>{moveMutation.error.message}</AlertDescription>
            </Alert>
          )}
          {sourceWorks.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Checkbox
                      checked={selectedWorks.size === sourceWorks.length}
                      onCheckedChange={(checked) =>
                        setSelectedWorks(
                          checked ? new Set(sourceWorks.map((work) => work.id)) : new Set(),
                        )
                      }
                      aria-label="تحديد كل الأعمال"
                    />
                  </TableHead>
                  <TableHead>العمل</TableHead>
                  <TableHead>النوع</TableHead>
                  <TableHead>السنة</TableHead>
                  <TableHead>حالة الإسناد</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sourceWorks.map((work) => (
                  <TableRow key={work.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedWorks.has(work.id)}
                        onCheckedChange={(checked) =>
                          setSelectedWorks((current) => {
                            const next = new Set(current);
                            if (checked) next.add(work.id);
                            else next.delete(work.id);
                            return next;
                          })
                        }
                        aria-label={`تحديد ${work.title}`}
                      />
                    </TableCell>
                    <TableCell>
                      <strong className="text-sm">{work.arabicTitle || work.title}</strong>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{work.kind}</Badge>
                    </TableCell>
                    <TableCell>{work.year ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {sourceId === unassignedSourceId
                          ? "غير مسند"
                          : source?.reviewCount
                            ? "قد يحتاج مراجعة"
                            : "مراجع"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>
                  {sourceId === unassignedSourceId
                    ? "لا توجد أعمال بلا كوكب"
                    : "لا توجد أعمال في هذا الكوكب"}
                </EmptyTitle>
                <EmptyDescription>
                  {sourceId === unassignedSourceId
                    ? "كل الأعمال المؤهلة مسندة إلى كوكب."
                    : "اختر كوكباً آخر أو ابدأ بإسناد عمل من صفحة الكتالوج."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
