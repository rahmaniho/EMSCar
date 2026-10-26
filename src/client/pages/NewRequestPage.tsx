import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ShieldAlert,
  Car,
  Plus,
  Calculator,
  CheckCircle2,
  FileImage,
} from 'lucide-react';
import { useAuth } from '../lib/auth-context.tsx';
import { apiFetch } from '../lib/api.ts';
import { GeoMapPicker } from '../components/GeoMapPicker.tsx';
import { formatToman } from '../lib/format.ts';
import {
  VEHICLE_CATEGORIES,
  VEHICLE_CATEGORY_LABELS,
  type VehicleCategory,
} from '../../shared/constants.ts';
import type { GeoPoint } from '../../shared/geo-utils.ts';
import type { PriceBreakdown } from '../../shared/pricing-formula.ts';

interface VehicleItem {
  id: number;
  brand: string;
  model: string;
  manufactureYear: number;
  plateNumber: string;
  category: VehicleCategory;
  categoryLabel: string;
}

interface CatalogServiceItem {
  id: number;
  slug: string;
  titleFa: string;
  categoryLabel: string;
  basePriceToman: number;
  requiresDestination: boolean;
  requiresOwnershipProof: boolean;
  supportedVehicleCategories: VehicleCategory[];
}

export function NewRequestPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedServiceId = Number(searchParams.get('serviceId') || 0);

  const [vehicles, setVehicles] = useState<VehicleItem[]>([]);
  const [services, setServices] = useState<CatalogServiceItem[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<number>(0);
  const [selectedServiceId, setSelectedServiceId] = useState<number>(preselectedServiceId);

  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [newVehicle, setNewVehicle] = useState({
    brand: '',
    model: '',
    manufactureYear: 1402,
    plateNumber: '',
    category: 'domestic' as VehicleCategory,
  });

  const [origin, setOrigin] = useState<GeoPoint>({ lat: 36.2688, lng: 50.0041 });
  const [originAddress, setOriginAddress] = useState(
    'قزوین، خیابان خیام جنوبی، نزدیک سبزه‌میدان'
  );
  const [destination, setDestination] = useState<GeoPoint | null>(null);
  const [destinationAddress, setDestinationAddress] = useState('');

  const [issueDescription, setIssueDescription] = useState('');
  const [ownershipConfirmed, setOwnershipConfirmed] = useState(true);
  const [isUrgent, setIsUrgent] = useState(false);
  const [discountCode, setDiscountCode] = useState('');
  const [photoFile, setPhotoFile] = useState<{
    name: string;
    mimeType: string;
    base64: string;
  } | null>(null);

  const [quoteBreakdown, setQuoteBreakdown] = useState<PriceBreakdown | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [idempotencyKey] = useState(() =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `idem-${Date.now()}-${Math.random()}`
  );

  useEffect(() => {
    void (async () => {
      try {
        const svcRes = await apiFetch<{ services: CatalogServiceItem[] }>(
          '/api/catalog/services'
        );
        setServices(svcRes.services);
        if (!selectedServiceId && svcRes.services.length > 0) {
          setSelectedServiceId(svcRes.services[0].id);
        }
      } catch {
        // ignore
      }
    })();
  }, []);

  useEffect(() => {
    if (!user || user.role !== 'customer') return;
    void (async () => {
      try {
        const vRes = await apiFetch<{ vehicles: VehicleItem[] }>(
          '/api/customers/vehicles'
        );
        setVehicles(vRes.vehicles);
        if (vRes.vehicles.length > 0) {
          setSelectedVehicleId(vRes.vehicles[0].id);
        } else {
          setShowAddVehicle(true);
        }
      } catch {
        // ignore
      }
    })();
  }, [user]);

  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId);
  const selectedService = services.find((s) => s.id === selectedServiceId);

  // استعلام زنده برآورد هزینه از سرور
  useEffect(() => {
    if (!selectedService || !selectedVehicle) {
      setQuoteBreakdown(null);
      return;
    }
    if (selectedService.requiresDestination && !destination) {
      setQuoteBreakdown(null);
      setQuoteError('برای محاسبه برآورد خدمات حمل/یدک‌کش، مقصد حمل را روی نقشه انتخاب کنید.');
      return;
    }

    let active = true;
    const timer = setTimeout(async () => {
      try {
        const res = await apiFetch<{
          quote: { breakdown: PriceBreakdown };
        }>('/api/pricing/quote', {
          method: 'POST',
          body: JSON.stringify({
            serviceId: selectedService.id,
            originLat: origin.lat,
            originLng: origin.lng,
            destinationLat: destination?.lat ?? null,
            destinationLng: destination?.lng ?? null,
            vehicleCategory: selectedVehicle.category,
            isUrgent,
            discountCode: discountCode.trim() || undefined,
          }),
        });
        if (active) {
          setQuoteBreakdown(res.quote.breakdown);
          setQuoteError(null);
        }
      } catch (err) {
        if (active) {
          setQuoteBreakdown(null);
          setQuoteError(
            err instanceof Error ? err.message : 'خطا در محاسبه برآورد تعرفه'
          );
        }
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [
    selectedService?.id,
    selectedVehicle?.id,
    origin.lat,
    origin.lng,
    destination?.lat,
    destination?.lng,
    isUrgent,
    discountCode,
  ]);

  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    try {
      const res = await apiFetch<{ vehicle: VehicleItem }>(
        '/api/customers/vehicles',
        {
          method: 'POST',
          body: JSON.stringify(newVehicle),
        }
      );
      setVehicles((prev) => [res.vehicle, ...prev]);
      setSelectedVehicleId(res.vehicle.id);
      setShowAddVehicle(false);
      setNewVehicle({
        brand: '',
        model: '',
        manufactureYear: 1402,
        plateNumber: '',
        category: 'domestic',
      });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'خطا در ثبت خودرو');
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setPhotoFile(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPhotoFile({
          name: file.name,
          mimeType: file.type || 'image/jpeg',
          base64: reader.result,
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitRequest = async (submitImmediately: boolean) => {
    setSubmitError(null);
    if (!selectedVehicleId) {
      setSubmitError('لطفاً ابتدا خودروی خود را انتخاب یا ثبت کنید.');
      return;
    }
    if (!selectedServiceId) {
      setSubmitError('لطفاً نوع خدمت درخواستی را انتخاب کنید.');
      return;
    }
    if (issueDescription.trim().length < 5) {
      setSubmitError('لطفاً توضیح کوتاهی از مشکل خودرو بنویسید (حداقل ۵ کاراکتر).');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch<{ request: { id: number } }>('/api/requests', {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify({
          vehicleId: selectedVehicleId,
          serviceId: selectedServiceId,
          originLat: origin.lat,
          originLng: origin.lng,
          originAddress,
          destinationLat: destination?.lat ?? null,
          destinationLng: destination?.lng ?? null,
          destinationAddress: destinationAddress || null,
          issueDescription,
          ownershipConfirmed,
          isUrgent,
          discountCode: discountCode.trim() || undefined,
          submitImmediately,
          idempotencyKey,
        }),
      });

      if (photoFile) {
        await apiFetch(`/api/requests/${res.request.id}/attachments`, {
          method: 'POST',
          body: JSON.stringify({
            originalName: photoFile.name,
            mimeType: photoFile.mimeType,
            base64Data: photoFile.base64,
          }),
        });
      }

      navigate(`/requests/${res.request.id}`);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'خطا در ثبت درخواست امداد'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="max-w-4xl mx-auto p-10 text-center text-sm text-slate-500">
        در حال آماده‌سازی فرم ثبت درخواست...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-4 shadow-xs">
          <ShieldAlert className="w-12 h-12 text-amber-500 mx-auto" />
          <h1 className="text-xl font-extrabold text-slate-900">
            ثبت درخواست امداد خودرو در استان قزوین
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            برای ثبت درخواست، ذخیره خودرو، پیگیری زنده مأموریت و صدور فاکتور رسمی، ابتدا
            وارد حساب کاربری مشتری شوید یا در کمتر از ۳۰ ثانیه ثبت‌نام کنید.
          </p>
          <Link
            to="/auth?redirect=/request/new"
            className="inline-block bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold px-6 py-3 rounded-xl text-sm transition"
          >
            ورود یا ثبت‌نام سریع مشتری
          </Link>
        </div>
      </div>
    );
  }

  if (user.role !== 'customer') {
    return (
      <div className="max-w-xl mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl border border-amber-200 p-8 text-center space-y-3">
          <h1 className="text-lg font-extrabold text-slate-900">
            شما با نقش «{user.role}» وارد شده‌اید
          </h1>
          <p className="text-xs text-slate-600">
            ثبت درخواست امداد مخصوص نقش «مشتری» است. برای مدیریت عملیات به پنل اختصاصی
            نقش خود مراجعه فرمایید.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-8 space-y-6">
        <div className="bg-slate-900 text-white rounded-2xl p-5 sm:p-6">
          <h1 className="text-xl font-extrabold flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-amber-400" />
            فرم هوشمند ثبت درخواست امداد خودرو (استان قزوین)
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            تمامی مراحل اعتبارسنجی محدوده، تطابق ناوگان و محاسبه تعرفه به‌صورت زنده از سرور
            انجام می‌شود.
          </p>
        </div>

        {submitError && (
          <div className="bg-rose-50 border border-rose-300 text-rose-900 p-4 rounded-xl text-xs font-bold">
            {submitError}
          </div>
        )}

        {/* گام ۱: انتخاب خودرو */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
              <Car className="w-4 h-4 text-amber-500" />
              ۱. انتخاب خودرو
            </h2>
            <button
              type="button"
              onClick={() => setShowAddVehicle((v) => !v)}
              className="text-xs font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>افزودن خودروی جدید</span>
            </button>
          </div>

          {vehicles.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {vehicles.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setSelectedVehicleId(v.id)}
                  className={`text-right p-3.5 rounded-xl border transition ${
                    selectedVehicleId === v.id
                      ? 'bg-amber-50 border-amber-400 ring-1 ring-amber-400'
                      : 'bg-slate-50 border-slate-200 hover:bg-white'
                  }`}
                >
                  <div className="font-bold text-sm text-slate-900">
                    {v.brand} {v.model} ({v.manufactureYear.toLocaleString('fa-IR')})
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5">{v.plateNumber}</div>
                  <span className="inline-block mt-1.5 text-[10px] font-bold bg-white border border-slate-200 px-2 py-0.5 rounded-full">
                    {v.categoryLabel}
                  </span>
                </button>
              ))}
            </div>
          )}

          {showAddVehicle && (
            <form
              onSubmit={handleAddVehicle}
              className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs"
            >
              <div>
                <label className="font-bold block mb-1">برند سازنده *</label>
                <input
                  type="text"
                  required
                  value={newVehicle.brand}
                  onChange={(e) =>
                    setNewVehicle({ ...newVehicle, brand: e.target.value })
                  }
                  placeholder="مثال: ایران‌خودرو"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                />
              </div>
              <div>
                <label className="font-bold block mb-1">مدل خودرو *</label>
                <input
                  type="text"
                  required
                  value={newVehicle.model}
                  onChange={(e) =>
                    setNewVehicle({ ...newVehicle, model: e.target.value })
                  }
                  placeholder="مثال: دنا پلاس"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                />
              </div>
              <div>
                <label className="font-bold block mb-1">پلاک انتظامی *</label>
                <input
                  type="text"
                  required
                  value={newVehicle.plateNumber}
                  onChange={(e) =>
                    setNewVehicle({ ...newVehicle, plateNumber: e.target.value })
                  }
                  placeholder="۶۸ د ۴۴۲ ایران ۷۹"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                />
              </div>
              <div>
                <label className="font-bold block mb-1">دسته فنی خودرو *</label>
                <select
                  value={newVehicle.category}
                  onChange={(e) =>
                    setNewVehicle({
                      ...newVehicle,
                      category: e.target.value as VehicleCategory,
                    })
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                >
                  {VEHICLE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {VEHICLE_CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2 flex justify-end gap-2">
                <button
                  type="submit"
                  className="bg-slate-900 text-white font-bold px-4 py-2 rounded-lg"
                >
                  ثبت خودرو در گاراژ من
                </button>
              </div>
            </form>
          )}
        </section>

        {/* گام ۲: انتخاب نوع خدمت */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
          <h2 className="font-extrabold text-sm text-slate-900">
            ۲. انتخاب خدمت موردنیاز
          </h2>
          <select
            value={selectedServiceId}
            onChange={(e) => setSelectedServiceId(Number(e.target.value))}
            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold"
          >
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.titleFa} — تعرفه پایه: {formatToman(s.basePriceToman)}
              </option>
            ))}
          </select>

          {selectedService?.requiresOwnershipProof && (
            <label className="flex items-start gap-2 bg-amber-50 border border-amber-300 p-3 rounded-xl text-xs text-amber-950 cursor-pointer">
              <input
                type="checkbox"
                checked={ownershipConfirmed}
                onChange={(e) => setOwnershipConfirmed(e.target.checked)}
                className="mt-1"
              />
              <span>
                <strong>تعهد قانونی مالکیت:</strong> تأیید می‌کنم مالک قانونی یا متصرف
                مجاز خودرو هستم و پیش از بازگشایی در خودرو، کارت خودرو و کارت ملی معتبر را
                به امدادگر ارائه خواهم داد.
              </span>
            </label>
          )}
        </section>

        {/* گام ۳: موقعیت مکانی روی نقشه و ثبت دستی آدرس */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
          <h2 className="font-extrabold text-sm text-slate-900">
            ۳. تعیین موقعیت توقف خودرو (و مقصد حمل در صورت نیاز)
          </h2>
          <GeoMapPicker
            origin={origin}
            originAddress={originAddress}
            onOriginChange={(pt, addr) => {
              setOrigin(pt);
              if (addr) setOriginAddress(addr);
            }}
            onOriginAddressChange={setOriginAddress}
            requiresDestination={Boolean(selectedService?.requiresDestination)}
            destination={destination}
            destinationAddress={destinationAddress}
            onDestinationChange={(pt, addr) => {
              setDestination(pt);
              if (addr) setDestinationAddress(addr);
            }}
            onDestinationAddressChange={setDestinationAddress}
          />
        </section>

        {/* گام ۴: شرح خرابی، تصویر اختیاری و گزینه‌ها */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <h2 className="font-extrabold text-sm text-slate-900">
            ۴. شرح مشکل خودرو و تصویر اختیاری
          </h2>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              علائم خرابی یا شرایط صحنه را بنویسید *
            </label>
            <textarea
              rows={3}
              required
              value={issueDescription}
              onChange={(e) => setIssueDescription(e.target.value)}
              placeholder="مثال: خودرو پس از توقف کوتاه استارت نمی‌خورد، چراغ باتری روشن است و خودرو در حاشیه امن متوقف شده است."
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                کد تخفیف (اختیاری — نمونه فعال: QAZVIN1405)
              </label>
              <input
                type="text"
                value={discountCode}
                onChange={(e) => setDiscountCode(e.target.value)}
                placeholder="QAZVIN1405"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs dir-ltr text-left uppercase"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                پیوست تصویر خصوصی از وضعیت خودرو (اختیاری)
              </label>
              <label className="flex items-center gap-2 border border-dashed border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-600 cursor-pointer hover:bg-slate-50">
                <FileImage className="w-4 h-4 text-amber-500" />
                <span className="truncate">
                  {photoFile ? photoFile.name : 'انتخاب تصویر (JPG/PNG حداکثر ۵ مگابایت)'}
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={isUrgent}
              onChange={(e) => setIsUrgent(e.target.checked)}
            />
            <span>
              درخواست اعزام فوق‌فوری در شرایط اضطراری جاده‌ای (مشمول ضریب سرویس فوری)
            </span>
          </label>
        </section>
      </div>

      {/* ستون کناری: برآورد زنده تعرفه و دکمه‌های تأیید */}
      <aside className="lg:col-span-4">
        <div className="sticky top-20 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 font-extrabold text-base text-slate-900 border-b border-slate-100 pb-3">
            <Calculator className="w-5 h-5 text-amber-500" />
            <span>برآورد شفاف هزینه (تومان)</span>
          </div>

          {quoteError ? (
            <div className="bg-amber-50 border border-amber-200 text-amber-950 p-3 rounded-xl text-xs leading-relaxed">
              {quoteError}
            </div>
          ) : quoteBreakdown ? (
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-600">اجرت پایه خدمت:</span>
                <span className="font-bold">
                  {formatToman(quoteBreakdown.baseServiceFeeToman)}
                </span>
              </div>
              {quoteBreakdown.towTransportFeeToman > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-600">
                    هزینه حمل ({quoteBreakdown.billableTowKm.toLocaleString('fa-IR')} کیلومتر):
                  </span>
                  <span className="font-bold">
                    {formatToman(quoteBreakdown.towTransportFeeToman)}
                  </span>
                </div>
              )}
              {quoteBreakdown.vehicleAdjustmentToman > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-600">
                    ضریب تخصصی خودرو ({quoteBreakdown.vehicleMultiplierApplied}x):
                  </span>
                  <span className="font-bold">
                    {formatToman(quoteBreakdown.vehicleAdjustmentToman)}
                  </span>
                </div>
              )}
              {quoteBreakdown.zoneAdjustmentToman > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-600">ضریب محدوده آزادراهی/حومه:</span>
                  <span className="font-bold">
                    {formatToman(quoteBreakdown.zoneAdjustmentToman)}
                  </span>
                </div>
              )}
              {quoteBreakdown.urgentNightSurchargeToman > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-600">فوق‌العاده فوری / شبانه:</span>
                  <span className="font-bold">
                    {formatToman(quoteBreakdown.urgentNightSurchargeToman)}
                  </span>
                </div>
              )}
              {quoteBreakdown.discountAmountToman > 0 && (
                <div className="flex justify-between text-emerald-700 font-bold">
                  <span>کسر کد تخفیف معتبر:</span>
                  <span>- {formatToman(quoteBreakdown.discountAmountToman)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-600">
                  مالیات و عوارض قانونی ({quoteBreakdown.taxRatePercent}٪):
                </span>
                <span className="font-bold">
                  {formatToman(quoteBreakdown.taxAmountToman)}
                </span>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                <span className="font-extrabold text-sm text-slate-900">
                  جمع برآورد اولیه:
                </span>
                <span className="font-black text-lg text-amber-700">
                  {formatToman(quoteBreakdown.totalToman)}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed pt-1">
                * این مبلغ «برآورد اولیه» بر اساس اطلاعات فعلی است. در صورت مصرف قطعه در
                محل، مبلغ نهایی پس از ثبت گزارش امدادگر و با تأیید شما محاسبه می‌شود.
              </p>
            </div>
          ) : (
            <div className="text-xs text-slate-400 py-4 text-center">
              در حال محاسبه برآورد تعرفه...
            </div>
          )}

          <div className="space-y-2 pt-2">
            <button
              type="button"
              disabled={submitting || Boolean(quoteError)}
              onClick={() => void handleSubmitRequest(true)}
              className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold py-3.5 rounded-xl text-sm shadow-sm flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {submitting
                  ? 'در حال ثبت و جستجوی امدادگر...'
                  : 'تأیید و ثبت نهایی درخواست امداد'}
              </span>
            </button>

            <button
              type="button"
              disabled={submitting || Boolean(quoteError)}
              onClick={() => void handleSubmitRequest(false)}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs transition disabled:opacity-50"
            >
              ذخیره به‌عنوان پیش‌نویس (بدون اعزام فوری)
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
