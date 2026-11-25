'use client'

import Link from 'next/link'
import { toast } from 'sonner'
import {
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Checkbox,
  DatePicker,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Icon,
  Input,
  Label,
  Progress,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui'

function GallerySection({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section
      id={id}
      data-gallery-section={id}
      className="flex flex-col gap-4 border-b border-border-subtle pb-8"
    >
      <h2 className="text-headline-sm text-text-primary">{title}</h2>
      {children}
    </section>
  )
}

export default function ComponentsGalleryPage() {
  return (
    <main
      data-page="components-gallery"
      className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-4 py-8 tablet:px-6 desktop:px-8"
    >
      <header className="flex flex-col gap-3">
        <p className="text-label-lg text-primary">گالری موقت کامپوننت‌ها · Phase C</p>
        <h1 className="text-headline-lg text-text-primary">
          پیش‌نمایش اجزای پایه رابط کاربری ·{' '}
          <span className="font-latin" dir="ltr">
            PharmaStock UI Kit
          </span>
        </h1>
        <p className="max-w-3xl text-body-md text-text-secondary">
          این صفحه یک پیش‌نمایش فنی موقت است (نه صفحه کسب‌وکار) برای تأیید وضعیت‌ها،{' '}
          <span className="font-latin" dir="ltr">
            RTL
          </span>
          ، دسترس‌پذیری صفحه‌کلید، و همخوانی بصری با توکن‌ها و مرجع{' '}
          <span className="font-latin" dir="ltr">
            Stitch
          </span>
          .
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/"
            className="text-body-sm text-primary underline-offset-4 hover:underline"
          >
            بازگشت به خانه
          </Link>
          <Link
            href="/tokens"
            className="text-body-sm text-primary underline-offset-4 hover:underline"
          >
            پیش‌نمایش توکن‌ها
          </Link>
        </div>
      </header>

      <GallerySection id="breadcrumb" title="مسیر صفحه · Breadcrumb">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">خانه</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/components">کامپوننت‌ها</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>گالری</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </GallerySection>

      <GallerySection id="button" title="دکمه · Button">
        <div className="flex flex-wrap items-center gap-3">
          <Button>ثبت موجودی</Button>
          <Button variant="secondary">ثانویه</Button>
          <Button variant="outline">حاشیه‌دار</Button>
          <Button variant="ghost">شبح</Button>
          <Button variant="destructive">حذف</Button>
          <Button variant="link">پیوند</Button>
          <Button loading>در حال ذخیره</Button>
          <Button disabled>غیرفعال</Button>
          <Button size="icon" aria-label="جستجو">
            <Icon name="search" size={18} />
          </Button>
        </div>
      </GallerySection>

      <GallerySection id="form-controls" title="ورودی‌ها · Input / Label / Textarea / Select / DatePicker">
        <div className="grid gap-4 tablet:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="drug-name">نام دارو</Label>
            <Input id="drug-name" placeholder="مثلاً استامینوفن" defaultValue="استامینوفن (Acetaminophen)" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="gallery-expiry">تاریخ انقضا (DatePicker)</Label>
            <DatePicker
              id="gallery-expiry"
              data-testid="gallery-date-picker"
              value="2027-06-15"
              placeholder="انتخاب تاریخ"
            />
            <p className="text-label-md text-text-secondary">
              تقویم میلادی shadcn؛ نمایش مقدار با تاریخ جلالی
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="irc-code">کد IRC</Label>
            <Input
              id="irc-code"
              className="font-latin tabular-nums-data"
              dir="ltr"
              placeholder="1234567890123"
              defaultValue="1234567890123"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="batch-error">سری ساخت (خطا)</Label>
            <Input id="batch-error" error defaultValue="BATCH-ERR" aria-describedby="batch-error-msg" />
            <p id="batch-error-msg" className="text-label-md text-status-critical-fg">
              سری ساخت نامعتبر است
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="storage">شرایط نگهداری</Label>
            <Select defaultValue="room">
              <SelectTrigger id="storage" className="w-full">
                <SelectValue placeholder="انتخاب کنید" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="room">دمای اتاق ۱۵–۲۵°C</SelectItem>
                  <SelectItem value="fridge">یخچال ۲–۸°C</SelectItem>
                  <SelectItem value="frozen">انجماد</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2 tablet:col-span-2">
            <Label htmlFor="notes">یادداشت انبار</Label>
            <Textarea id="notes" placeholder="توضیحات اختیاری..." defaultValue="نیاز به جابه‌جایی به قفسه سرد." />
          </div>
        </div>
      </GallerySection>

      <GallerySection id="toggles" title="انتخاب‌گرها · Checkbox / Radio / Switch">
        <div className="flex flex-wrap items-start gap-8">
          <div className="flex items-center gap-2">
            <Checkbox id="fefo" defaultChecked />
            <Label htmlFor="fefo">اولویت FEFO</Label>
          </div>
          <RadioGroup defaultValue="in-stock" className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <RadioGroupItem value="in-stock" id="in-stock" />
              <Label htmlFor="in-stock">موجود</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="low" id="low" />
              <Label htmlFor="low">روبه‌اتمام</Label>
            </div>
          </RadioGroup>
          <div className="flex items-center gap-3">
            <Switch id="alerts" defaultChecked />
            <Label htmlFor="alerts">هشدار انقضا</Label>
          </div>
        </div>
      </GallerySection>

      <GallerySection id="badge" title="نشان وضعیت · Badge">
        <div className="flex flex-wrap gap-2">
          <Badge variant="valid">
            <Icon name="check_circle" size={14} />
            موجود و معتبر
          </Badge>
          <Badge variant="warning">
            <Icon name="warning" size={14} />
            روبه‌اتمام
          </Badge>
          <Badge variant="expiring">
            <Icon name="schedule" size={14} />
            نزدیک به انقضا
          </Badge>
          <Badge variant="critical">
            <Icon name="dangerous" size={14} />
            منقضی / ناموجود
          </Badge>
          <Badge variant="info">
            <Icon name="info" size={14} />
            در مسیر
          </Badge>
          <Badge variant="neutral">آرشیو</Badge>
        </div>
      </GallerySection>

      <GallerySection id="card" title="کارت · Card">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>شاخص موجودی بحرانی</CardTitle>
            <CardDescription>داروهای زیر نقطه سفارش مجدد</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-kpi tabular-nums-data text-status-critical-fg">۲۴</p>
            <p className="mt-1 text-body-sm text-text-secondary">
              نسبت به ماه گذشته{' '}
              <span className="font-latin tabular-nums-data" dir="ltr">
                +۴٪
              </span>
            </p>
          </CardContent>
          <CardFooter>
            <Button size="sm" variant="outline">
              مشاهده فهرست
            </Button>
          </CardFooter>
        </Card>
      </GallerySection>

      <GallerySection id="overlays" title="لایه‌ها · Dialog / Sheet / Tooltip / Toast">
        <div className="flex flex-wrap gap-3">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="open-dialog">
                باز کردن دیالوگ
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>تأیید عملیات بحرانی</DialogTitle>
                <DialogDescription>
                  آیا از ثبت خروج این سری ساخت اطمینان دارید؟ این عمل قابل بازگشت نیست.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline">انصراف</Button>
                <Button variant="destructive">تأیید و ثبت</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Sheet>
            <SheetTrigger asChild>
              <Button data-testid="open-sheet">باز کردن کشو (سمت چپ RTL)</Button>
            </SheetTrigger>
            <SheetContent side="end">
              <SheetHeader>
                <SheetTitle>افزودن سری ساخت</SheetTitle>
                <SheetDescription>
                  فرم سریع افزودن بچ بدون ترک صفحه فهرست.
                </SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-3 px-4">
                <Label htmlFor="sheet-batch">شماره سری</Label>
                <Input id="sheet-batch" className="font-latin" dir="ltr" placeholder="LOT-2026-01" />
              </div>
              <SheetFooter>
                <Button>ذخیره</Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="راهنما">
                <Icon name="help" size={18} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">راهنمای کوتاه FEFO</TooltipContent>
          </Tooltip>

          <Button
            variant="secondary"
            onClick={() => toast.success('موجودی با موفقیت به‌روزرسانی شد')}
          >
            نمایش Toast
          </Button>
        </div>
      </GallerySection>

      <GallerySection id="tabs-progress" title="زبانه‌ها و پیشرفت · Tabs / Progress">
        <Tabs defaultValue="stock">
          <TabsList>
            <TabsTrigger value="stock">موجودی</TabsTrigger>
            <TabsTrigger value="expiry">انقضا</TabsTrigger>
            <TabsTrigger value="moves">جابه‌جایی</TabsTrigger>
          </TabsList>
          <TabsContent value="stock" className="pt-3">
            <p className="text-body-md text-text-secondary">خلاصه موجودی قفسه‌ها</p>
          </TabsContent>
          <TabsContent value="expiry" className="pt-3">
            <p className="text-body-md text-text-secondary">هشدارهای نزدیک به انقضا</p>
          </TabsContent>
          <TabsContent value="moves" className="pt-3">
            <p className="text-body-md text-text-secondary">انتقال‌های داخلی</p>
          </TabsContent>
        </Tabs>
        <div className="mt-4 flex flex-col gap-2">
          <Label>پیشرفت شمارش انبارگردانی</Label>
          <Progress value={68} aria-label="۶۸ درصد تکمیل" />
        </div>
      </GallerySection>

      <GallerySection id="table" title="جدول فشرده · Table">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>نام دارو</TableHead>
              <TableHead>کد IRC</TableHead>
              <TableHead>موجودی</TableHead>
              <TableHead>انقضا</TableHead>
              <TableHead>وضعیت</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>
                استامینوفن{' '}
                <span className="font-latin text-text-secondary" dir="ltr">
                  (Acetaminophen)
                </span>
              </TableCell>
              <TableCell className="font-latin" dir="ltr">
                1234567890123
              </TableCell>
              <TableCell>۱٬۲۴۰</TableCell>
              <TableCell>۱۴۰۴/۰۶/۱۵</TableCell>
              <TableCell>
                <Badge variant="valid">معتبر</Badge>
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell>
                آموکسی‌سیلین{' '}
                <span className="font-latin text-text-secondary" dir="ltr">
                  (Amoxicillin)
                </span>
              </TableCell>
              <TableCell className="font-latin" dir="ltr">
                9876543210987
              </TableCell>
              <TableCell>۴۸</TableCell>
              <TableCell>۱۴۰۳/۰۹/۰۱</TableCell>
              <TableCell>
                <Badge variant="expiring">نزدیک انقضا</Badge>
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell>
                انسولین{' '}
                <span className="font-latin text-text-secondary" dir="ltr">
                  (Insulin)
                </span>
              </TableCell>
              <TableCell className="font-latin" dir="ltr">
                5555666677778
              </TableCell>
              <TableCell>۰</TableCell>
              <TableCell>۱۴۰۳/۰۷/۲۰</TableCell>
              <TableCell>
                <Badge variant="critical">ناموجود</Badge>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </GallerySection>
    </main>
  )
}
