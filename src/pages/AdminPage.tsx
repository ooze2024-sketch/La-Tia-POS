import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import ExcelJS from "exceljs";
import {
  apiClient,
  categoryService,
  productService,
  productImageService,
  inventoryService,
  authService,
  saleService,
  syncService,
  settingsService,
} from "../services";
import type {
  DailySalesSummary,
  Sale,
  SaleActionRequest,
  SaleActionRequestStatus,
  SaleActionType,
} from "../services/saleService";
import type {
  InventoryDailySummary,
  StockMovement,
} from "../services/inventoryService";
import type {
  SyncQueueItem,
  SyncQueueStatus,
  SyncQueueSummary,
} from "../services/syncService";
import type { PosSettings } from "../services/settingsService";
import "./AdminPage.css";

interface FoodItem {
  id: number;
  name: string;
  category_id: number;
  category?: string;
  cost: number;
  price: number;
  description: string;
  image_path?: string | null;
  image_url?: string | null;
}

interface FoodCategory {
  id: number;
  name: string;
}

interface InventoryItem {
  id: number;
  name: string;
  quantity: number;
  unit: string;
}

interface Transaction {
  id: string;
  itemName: string;
  quantity: number;
  amount: number;
  paymentMethod: string;
  date: Date;
  cost: number;
}

type ReportDateField = "startDate" | "endDate";
type ReportViewType = "daily" | "monthly";

interface ReportRange {
  startDate: string;
  endDate: string;
}

interface ReportCategoryRow {
  category: string;
  quantity: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
  revenueSharePct: number;
}

interface ReportProductRow {
  product: string;
  quantity: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
  grossMarginPct: number;
}

interface ComparativeProductRow {
  product: string;
  period1Qty: number;
  period1Revenue: number;
  period2Qty: number;
  period2Revenue: number;
  qtyChangePct: number | null;
  revenueChange: number;
  revenueChangePct: number | null;
}

interface ReportPayload {
  reportType: ReportViewType;
  title: string;
  subtitle: string;
  generatedAt: string;
  period: ReportRange;
  periodLabel: string;
  comparisonLabel: string;
  totalTransactions: number;
  totalItems: number;
  grossRevenue: number;
  refundAdjustments: number;
  netRevenue: number;
  cogs: number;
  grossProfit: number;
  grossMarginPct: number;
  averageDailySales: number;
  paymentBreakdown: Array<{ method: string; amount: number; sharePct: number }>;
  categories: ReportCategoryRow[];
  topProducts: ReportProductRow[];
  comparisonProducts: ComparativeProductRow[];
  dailyTrend: Array<{ label: string; revenue: number }>;
  transactions: Array<{
    reference: string;
    dateTime: string;
    paymentMethod: string;
    items: number;
    netTotal: number;
  }>;
}
const REPORT_CALENDAR_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const REPORT_CALENDAR_YEARS = Array.from({ length: 101 }, (_, index) => 2000 + index);

function Admin() {
  const navigate = useNavigate();
  const startupToday = new Date();
  const startupTodayIso = `${startupToday.getFullYear()}-${String(startupToday.getMonth() + 1).padStart(2, "0")}-${String(startupToday.getDate()).padStart(2, "0")}`;
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [inventoryView, setInventoryView] = useState("inventory");
  const [reportsView, setReportsView] = useState("sales");
  const [reportDateFilters, setReportDateFilters] = useState({
    startDate: startupTodayIso,
    endDate: startupTodayIso,
  });
  const [appliedReportDateRange, setAppliedReportDateRange] = useState<{
    startDate: string;
    endDate: string;
  } | null>({
    startDate: startupTodayIso,
    endDate: startupTodayIso,
  });
  const [reportRangeTransactions, setReportRangeTransactions] = useState<Transaction[] | null>(null);
  const [openReportDatePicker, setOpenReportDatePicker] = useState<ReportDateField | null>(null);
  const [reportPickerMonth, setReportPickerMonth] = useState<Record<ReportDateField, Date>>({
    startDate: new Date(),
    endDate: new Date(),
  });
  const [isApplyingReportDateFilter, setIsApplyingReportDateFilter] = useState(false);
  const [returnsStatusFilter, setReturnsStatusFilter] = useState<SaleActionRequestStatus | "all">("requested");
  const [returnsSearch, setReturnsSearch] = useState("");
  const [receiptFilters, setReceiptFilters] = useState({
    reference: "",
    startDate: "",
    endDate: "",
  });
  const [openReceiptDatePicker, setOpenReceiptDatePicker] = useState<ReportDateField | null>(null);
  const [receiptPickerMonth, setReceiptPickerMonth] = useState<Record<ReportDateField, Date>>({
    startDate: new Date(),
    endDate: new Date(),
  });
  const [syncStatusFilter, setSyncStatusFilter] = useState<SyncQueueStatus | "all">("all");
  const [categories, setCategories] = useState<FoodCategory[]>([]);
  const [items, setItems] = useState<FoodItem[]>([]);
  const [newCategory, setNewCategory] = useState("");
  const [isAddingCategory, setIsAddingCategory] = useState(false); // prevent spam clicking
  // derived state to check for duplicates
  const isCategoryDuplicate: boolean = Boolean(
    newCategory.trim() &&
      categories.some(
        (c) => c.name.trim().toLowerCase() === newCategory.trim().toLowerCase()
      )
  );
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [newInventoryItem, setNewInventoryItem] = useState({
    name: "",
    quantity: "",
    unit: "",
  });
  // Derived state to check for duplicate inventory items
  const isInventoryDuplicate: boolean = Boolean(
    newInventoryItem.name.trim() &&
      inventory.some(
        (item) => item.name.trim().toLowerCase() === newInventoryItem.name.trim().toLowerCase()
      )
  );
  const [showPaymentMethods, setShowPaymentMethods] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [inlineItemForm, setInlineItemForm] = useState({
    name: "",
    cost: "",
    price: "",
  });
  // Transaction data will be loaded from API
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [todayTransactions, setTodayTransactions] = useState<Transaction[]>([]);
  const [dailySalesSummary, setDailySalesSummary] = useState<DailySalesSummary | null>(null);
  const [salesForReturns, setSalesForReturns] = useState<Sale[]>([]);
  const [returnsRequests, setReturnsRequests] = useState<SaleActionRequest[]>([]);
  const [newActionRequest, setNewActionRequest] = useState<{
    saleReference: string;
    actionType: SaleActionType;
    reason: string;
    requestedAmount: string;
  }>({
    saleReference: "",
    actionType: "refund",
    reason: "",
    requestedAmount: "",
  });
  const [isLoadingReturns, setIsLoadingReturns] = useState(false);
  const [isSubmittingReturnRequest, setIsSubmittingReturnRequest] = useState(false);
  const [isReviewingRequestId, setIsReviewingRequestId] = useState<number | null>(null);
  const [receiptSearchResults, setReceiptSearchResults] = useState<Sale[]>([]);
  const [selectedReceiptSale, setSelectedReceiptSale] = useState<Sale | null>(null);
  const [isLoadingReceipts, setIsLoadingReceipts] = useState(false);
  const [syncQueueItems, setSyncQueueItems] = useState<SyncQueueItem[]>([]);
  const [syncSummary, setSyncSummary] = useState<SyncQueueSummary | null>(null);
  const [isLoadingSyncQueue, setIsLoadingSyncQueue] = useState(false);
  const [isSyncActionItemId, setIsSyncActionItemId] = useState<number | null>(null);
  const [syncVersion, setSyncVersion] = useState("-");
  const [syncLastCheckedAt, setSyncLastCheckedAt] = useState("");
  const [syncEndpointAvailable, setSyncEndpointAvailable] = useState(true);
  const [syncLoadError, setSyncLoadError] = useState("");
  const [paymentMethods, setPaymentMethods] = useState({
    bank_transfer: false,
    card: false,
    credit: false,
    food_panda: false,
    gcash: false,
    grab: false,
    maya: false,
  });
  const [defaultTaxRate, setDefaultTaxRate] = useState("0");
  const [defaultDiscountRate, setDefaultDiscountRate] = useState("0");
  const [isSavingPosSettings, setIsSavingPosSettings] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [editConfirmData, setEditConfirmData] = useState<{
    id: number;
    oldName: string;
    newName: string;
  } | null>(null);
  const [isSavingItem, setIsSavingItem] = useState(false);
  const [isUploadingImageItemId, setIsUploadingImageItemId] = useState<number | null>(null);
  const [dragOverImageItemId, setDragOverImageItemId] = useState<number | null>(null);
  const [itemImagePreviewUrls, setItemImagePreviewUrls] = useState<Record<number, string>>({});
  const [isSavingInventory, setIsSavingInventory] = useState(false);
  const [itemDeleteConfirmId, setItemDeleteConfirmId] = useState<number | null>(null);
  const [deleteConfirmItemName, setDeleteConfirmItemName] = useState<string>("");
  const [editingItemData, setEditingItemData] = useState<{
    id: number;
    name: string;
    cost: number;
    price: number;
  } | null>(null);
  const [itemIngredients, setItemIngredients] = useState<{
    [key: number]: Array<{ inventoryItemId: number; quantity: number }>;
  }>({});
  const [editingIngredientItemId, setEditingIngredientItemId] = useState<number | null>(null);
  const [tempIngredients, setTempIngredients] = useState<Array<{ inventoryItemId: number; quantity: number }>>([]);
  const [inventoryDailySummaryMap, setInventoryDailySummaryMap] = useState<Record<number, InventoryDailySummary>>({});
  const [inventoryOpeningInputs, setInventoryOpeningInputs] = useState<Record<number, string>>({});
  const [inventoryHistoryByItemId, setInventoryHistoryByItemId] = useState<Record<number, StockMovement[]>>({});
  const [expandedInventoryHistoryIds, setExpandedInventoryHistoryIds] = useState<number[]>([]);
  const [loadingInventoryHistoryIds, setLoadingInventoryHistoryIds] = useState<number[]>([]);
  const [isApplyingOpeningItemId, setIsApplyingOpeningItemId] = useState<number | null>(null);
  const receiptFiltersRef = useRef(receiptFilters);
  const appliedReportDateRangeRef = useRef(appliedReportDateRange);
  const reportDatePickerRef = useRef<HTMLDivElement | null>(null);
  const receiptDatePickerRef = useRef<HTMLDivElement | null>(null);
  const itemImagePreviewUrlsRef = useRef<Record<number, string>>({});
  const loadingItemImageIdsRef = useRef<Set<number>>(new Set());

  // Load data from API on component mount
  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    receiptFiltersRef.current = receiptFilters;
  }, [receiptFilters]);

  useEffect(() => {
    appliedReportDateRangeRef.current = appliedReportDateRange;
  }, [appliedReportDateRange]);

  useEffect(() => {
    itemImagePreviewUrlsRef.current = itemImagePreviewUrls;
  }, [itemImagePreviewUrls]);

  useEffect(() => {
    // Keep object URL cache clean when products disappear from the list.
    const validIds = new Set(items.map((item) => item.id));
    setItemImagePreviewUrls((current) => {
      const next: Record<number, string> = { ...current };
      let changed = false;

      Object.entries(current).forEach(([key, url]) => {
        const itemId = Number(key);
        if (!validIds.has(itemId)) {
          URL.revokeObjectURL(url);
          delete next[itemId];
          loadingItemImageIdsRef.current.delete(itemId);
          changed = true;
        }
      });

      return changed ? next : current;
    });
  }, [items]);

  useEffect(() => {
    let cancelled = false;

    const fetchMissingItemImages = async () => {
      const candidates = items.filter(
        (item) =>
          Boolean(item.image_path || item.image_url) &&
          !itemImagePreviewUrlsRef.current[item.id] &&
          !loadingItemImageIdsRef.current.has(item.id)
      );

      await Promise.all(
        candidates.map(async (item) => {
          loadingItemImageIdsRef.current.add(item.id);
          try {
            const response = await apiClient.get(`/products/${item.id}/image`, {
              responseType: "blob",
            });
            if (cancelled) {
              return;
            }

            const objectUrl = URL.createObjectURL(response.data as Blob);
            setItemImagePreviewUrls((current) => {
              const previous = current[item.id];
              if (previous) {
                URL.revokeObjectURL(previous);
              }
              return {
                ...current,
                [item.id]: objectUrl,
              };
            });
          } catch (error) {
            console.warn(`Failed to load preview image for product ${item.id}.`, error);
          } finally {
            loadingItemImageIdsRef.current.delete(item.id);
          }
        })
      );
    };

    void fetchMissingItemImages();

    return () => {
      cancelled = true;
    };
  }, [items]);

  useEffect(() => {
    return () => {
      Object.values(itemImagePreviewUrlsRef.current).forEach((url) => {
        URL.revokeObjectURL(url);
      });
    };
  }, []);

  useEffect(() => {
    if (!openReportDatePicker) {
      return;
    }

    const onMouseDown = (event: MouseEvent) => {
      if (
        reportDatePickerRef.current &&
        !reportDatePickerRef.current.contains(event.target as Node)
      ) {
        setOpenReportDatePicker(null);
      }
    };

    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [openReportDatePicker]);

  useEffect(() => {
    if (!openReceiptDatePicker) {
      return;
    }

    const onMouseDown = (event: MouseEvent) => {
      if (
        receiptDatePickerRef.current &&
        !receiptDatePickerRef.current.contains(event.target as Node)
      ) {
        setOpenReceiptDatePicker(null);
      }
    };

    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [openReceiptDatePicker]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      loadSalesData();
    }, 5000);

    return () => window.clearInterval(timer);
  }, []);

  const getSaleLineItems = (sale: Sale): Array<any> => {
    const rawSale = sale as any;
    if (Array.isArray(sale.saleItems)) {
      return sale.saleItems;
    }
    if (Array.isArray(rawSale.sale_items)) {
      return rawSale.sale_items;
    }
    return [];
  };

  const getSalePayments = (sale: Sale): Array<any> => {
    const rawSale = sale as any;
    if (Array.isArray(sale.payments)) {
      return sale.payments;
    }
    if (Array.isArray(rawSale.payment)) {
      return rawSale.payment;
    }
    return [];
  };

  const getReceiptReferenceDisplay = (sale: Sale) => {
    return `#${String(sale.id).padStart(5, "0")}`;
  };

  const getSaleStatus = (sale: Sale) => String(sale.status || "").toLowerCase();

  const getSaleNetTotal = (sale: Sale) => {
    const rawSale = sale as any;
    const explicitNetTotal = Number(rawSale.net_total);
    if (Number.isFinite(explicitNetTotal)) {
      return explicitNetTotal;
    }

    const paymentList = getSalePayments(sale);
    const refundAdjustments = Array.isArray(paymentList)
      ? paymentList.reduce((sum, payment) => {
          const amount = Number(payment?.amount || 0);
          return amount < 0 ? sum + amount : sum;
        }, 0)
      : 0;

    const grossTotal = Number(sale.total || 0);
    const netTotal = grossTotal + refundAdjustments;
    return netTotal > 0 ? netTotal : 0;
  };

  const isSaleReportable = (sale: Sale) => {
    const status = getSaleStatus(sale);
    return status !== "void" && status !== "refunded" && getSaleNetTotal(sale) > 0;
  };

  const mapSaleToTransaction = (sale: Sale): Transaction => {
    const createdAt = sale.created_at ? new Date(sale.created_at) : new Date();
    const safeDate = Number.isNaN(createdAt.getTime()) ? new Date() : createdAt;
    const saleItems = getSaleLineItems(sale);
    const totalQty = Array.isArray(saleItems)
      ? saleItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
      : 0;
    const paymentList = getSalePayments(sale);
    const paymentMethod = Array.isArray(paymentList) && paymentList.length > 0
      ? String(paymentList[0]?.method || "cash")
      : "cash";

    return {
      id: String(sale.id),
      itemName: sale.public_reference || getReceiptReferenceDisplay(sale),
      quantity: totalQty > 0 ? totalQty : 1,
      amount: getSaleNetTotal(sale),
      paymentMethod,
      date: safeDate,
      cost: 0,
    };
  };

  const resolveDateRange = (startDateInput: string, endDateInput: string) => {
    const firstDate = startDateInput || endDateInput;
    const secondDate = endDateInput || startDateInput;
    if (!firstDate || !secondDate) {
      return null;
    }

    if (firstDate <= secondDate) {
      return { startDate: firstDate, endDate: secondDate };
    }

    return { startDate: secondDate, endDate: firstDate };
  };

  const isSaleInsideDateRange = (
    sale: Sale,
    dateRange: { startDate: string; endDate: string }
  ) => {
    if (!sale.created_at) {
      return false;
    }

    const createdAt = new Date(sale.created_at);
    if (Number.isNaN(createdAt.getTime())) {
      return false;
    }

    const rangeStart = new Date(`${dateRange.startDate}T00:00:00`);
    const rangeEnd = new Date(`${dateRange.endDate}T23:59:59.999`);
    return createdAt.getTime() >= rangeStart.getTime() && createdAt.getTime() <= rangeEnd.getTime();
  };

  const loadSalesData = async () => {
    try {
      const salesData = await saleService.getAll();
      setSalesForReturns(salesData);
      const currentReceiptFilters = receiptFiltersRef.current;

      let dailyTransactionsFromApi: Transaction[] = [];
      let summaryFromApi: DailySalesSummary | null = null;
      try {
        const dailyData = await saleService.getDailySales();
        summaryFromApi = dailyData.summary;
        dailyTransactionsFromApi = (dailyData.sales || [])
          .filter(isSaleReportable)
          .map(mapSaleToTransaction);
      } catch (dailyError) {
        console.warn("Daily sales summary endpoint unavailable, using client fallback:", dailyError);
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayFallbackTransactions = salesData
        .filter(isSaleReportable)
        .map(mapSaleToTransaction)
        .filter((t) => {
          const transDate = new Date(t.date);
          transDate.setHours(0, 0, 0, 0);
          return transDate.getTime() === today.getTime();
        });

      setDailySalesSummary(summaryFromApi);
      setTodayTransactions(
        dailyTransactionsFromApi.length > 0
          ? dailyTransactionsFromApi
          : todayFallbackTransactions
      );
      if (
        !currentReceiptFilters.reference.trim() &&
        !currentReceiptFilters.startDate &&
        !currentReceiptFilters.endDate
      ) {
        setReceiptSearchResults(
          [...salesData].sort(
            (a, b) =>
              new Date(b.created_at || 0).getTime() -
              new Date(a.created_at || 0).getTime()
          )
        );
      }

      const reportableSales = salesData.filter(isSaleReportable);
      setTransactions(reportableSales.map(mapSaleToTransaction));

      const currentAppliedRange = appliedReportDateRangeRef.current;
      if (currentAppliedRange) {
        const refreshedRangeTransactions = reportableSales
          .filter((sale) => isSaleInsideDateRange(sale, currentAppliedRange))
          .map(mapSaleToTransaction);
        setReportRangeTransactions(refreshedRangeTransactions);
      }
    } catch (error) {
      console.error("Failed to load sales data:", error);
      setSalesForReturns([]);
      setTransactions([]);
      setTodayTransactions([]);
      setDailySalesSummary(null);
      setReceiptSearchResults([]);
      setReportRangeTransactions((current) => (current === null ? null : []));
    }
  };

  const applyReportDateFilter = async () => {
    const resolvedRange = resolveDateRange(reportDateFilters.startDate, reportDateFilters.endDate);
    if (!resolvedRange) {
      alert("Select at least one date to apply report filters.");
      return;
    }

    await applyResolvedReportDateRange(resolvedRange);
  };

  const applyResolvedReportDateRange = async (resolvedRange: {
    startDate: string;
    endDate: string;
  }) => {
    setIsApplyingReportDateFilter(true);
    try {
      const salesInRange = await saleService.getSalesByDateRange(
        resolvedRange.startDate,
        resolvedRange.endDate
      );
      const reportableRangeTransactions = salesInRange
        .filter(isSaleReportable)
        .map(mapSaleToTransaction);

      setAppliedReportDateRange(resolvedRange);
      setReportDateFilters(resolvedRange);
      setReportRangeTransactions(reportableRangeTransactions);
    } catch (error: any) {
      console.error("Failed to load report date range:", error);
      alert(error.response?.data?.message || "Failed to load report data for selected dates.");
    } finally {
      setIsApplyingReportDateFilter(false);
    }
  };

  const toLocalIsoDate = (value: Date) => {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const parseLocalIsoDate = (isoDate: string) => {
    return new Date(`${isoDate}T12:00:00`);
  };

  const getReportCalendarDays = (monthCursor: Date) => {
    const firstDayOfMonth = new Date(
      monthCursor.getFullYear(),
      monthCursor.getMonth(),
      1
    );
    const gridStartDate = new Date(firstDayOfMonth);
    gridStartDate.setDate(firstDayOfMonth.getDate() - firstDayOfMonth.getDay());

    const cells: Array<{ date: Date; isCurrentMonth: boolean }> = [];
    for (let i = 0; i < 42; i += 1) {
      const cellDate = new Date(gridStartDate);
      cellDate.setDate(gridStartDate.getDate() + i);
      cells.push({
        date: cellDate,
        isCurrentMonth: cellDate.getMonth() === monthCursor.getMonth(),
      });
    }
    return cells;
  };

  const shiftReportPickerMonth = (field: ReportDateField, delta: number) => {
    setReportPickerMonth((current) => ({
      ...current,
      [field]: new Date(
        current[field].getFullYear(),
        current[field].getMonth() + delta,
        1
      ),
    }));
  };

  const setReportPickerMonthAndYear = (
    field: ReportDateField,
    month: number,
    year: number
  ) => {
    setReportPickerMonth((current) => ({
      ...current,
      [field]: new Date(year, month, 1),
    }));
  };

  const setReportDateField = (field: ReportDateField, value: string) => {
    setReportDateFilters((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const openCustomReportDatePicker = (field: ReportDateField) => {
    const selectedIso = reportDateFilters[field];
    const seed = selectedIso ? parseLocalIsoDate(selectedIso) : new Date();
    setReportPickerMonth((current) => ({
      ...current,
      [field]: new Date(seed.getFullYear(), seed.getMonth(), 1),
    }));
    setOpenReportDatePicker(field);
  };

  const formatIsoDateForDisplay = (isoDate?: string) => {
    if (!isoDate) {
      return "Not selected";
    }

    const parsed = new Date(`${isoDate}T12:00:00`);
    if (Number.isNaN(parsed.getTime())) {
      return isoDate;
    }

    return parsed.toLocaleDateString("en-US", {
      weekday: "short",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatMonthLabel = (value: Date) => {
    return value.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  };

  const renderReportDateField = (field: ReportDateField, label: string, id: string) => {
    const selectedIso = reportDateFilters[field];
    const selectedDisplay = selectedIso
      ? formatIsoDateForDisplay(selectedIso)
      : "Select date";
    const monthCursor = reportPickerMonth[field];
    const dayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
    const cells = getReportCalendarDays(monthCursor);
    const isOpen = openReportDatePicker === field;

    return (
      <div
        className="report-filter-field report-date-field"
        ref={isOpen ? reportDatePickerRef : undefined}
      >
        <label htmlFor={id}>{label}</label>
        <button
          type="button"
          id={id}
          className="report-date-trigger"
          onClick={() =>
            isOpen ? setOpenReportDatePicker(null) : openCustomReportDatePicker(field)
          }
          aria-expanded={isOpen}
        >
          {selectedDisplay}
        </button>
        <div className="report-filter-helper">
          Selected: {formatIsoDateForDisplay(selectedIso)}
        </div>

        {isOpen && (
          <div className="report-date-popup" role="dialog" aria-label={`${label} calendar`}>
            <div className="report-date-popup-header">
              <button
                type="button"
                className="report-date-nav-btn"
                onClick={() => shiftReportPickerMonth(field, -1)}
                aria-label="Previous month"
              >
                Prev
              </button>
              <div className="report-date-month-label">{formatMonthLabel(monthCursor)}</div>
              <button
                type="button"
                className="report-date-nav-btn"
                onClick={() => shiftReportPickerMonth(field, 1)}
                aria-label="Next month"
              >
                Next
              </button>
            </div>
            <div className="report-date-jump-controls">
              <select
                className="report-date-select"
                value={monthCursor.getMonth()}
                onChange={(event) =>
                  setReportPickerMonthAndYear(
                    field,
                    Number(event.target.value),
                    monthCursor.getFullYear()
                  )
                }
                aria-label="Select month"
              >
                {REPORT_CALENDAR_MONTHS.map((monthName, index) => (
                  <option key={`${monthName}-${index}`} value={index}>
                    {monthName}
                  </option>
                ))}
              </select>
              <select
                className="report-date-select report-date-year-select"
                value={monthCursor.getFullYear()}
                onChange={(event) =>
                  setReportPickerMonthAndYear(
                    field,
                    monthCursor.getMonth(),
                    Number(event.target.value)
                  )
                }
                aria-label="Select year"
              >
                {REPORT_CALENDAR_YEARS.map((year) => (
                  <option key={`year-${year}`} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
            <div className="report-date-grid report-date-grid-days">
              {dayNames.map((day) => (
                <div key={`${field}-${day}`} className="report-date-day-name">
                  {day}
                </div>
              ))}
            </div>
            <div className="report-date-grid">
              {cells.map((cell) => {
                const cellIso = toLocalIsoDate(cell.date);
                const isSelected = selectedIso === cellIso;
                return (
                  <button
                    key={`${field}-${cellIso}`}
                    type="button"
                    className={`report-date-cell ${isSelected ? "selected" : ""} ${cell.isCurrentMonth ? "" : "outside-month"}`}
                    onClick={() => {
                      setReportDateField(field, cellIso);
                      setOpenReportDatePicker(null);
                    }}
                    title={formatIsoDateForDisplay(cellIso)}
                  >
                    <span>{cell.date.getDate()}</span>
                    {!cell.isCurrentMonth && (
                      <small>{cell.date.toLocaleDateString("en-US", { month: "short" })}</small>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="report-date-popup-actions">
              <button
                type="button"
                className="report-date-link-btn"
                onClick={() => setReportDateField(field, "")}
              >
                Clear
              </button>
              <button
                type="button"
                className="report-date-link-btn"
                onClick={() => {
                  setReportDateField(field, toLocalIsoDate(new Date()));
                  setOpenReportDatePicker(null);
                }}
              >
                Today
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const applyReportDatePreset = async (
    preset: "today" | "yesterday" | "last7days" | "thisMonth"
  ) => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    let start = new Date(now);
    let end = new Date(now);

    if (preset === "yesterday") {
      start.setDate(start.getDate() - 1);
      end = new Date(start);
    } else if (preset === "last7days") {
      start.setDate(start.getDate() - 6);
    } else if (preset === "thisMonth") {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const range = {
      startDate: toLocalIsoDate(start),
      endDate: toLocalIsoDate(end),
    };

    setReportDateFilters(range);
    await applyResolvedReportDateRange(range);
  };

  const resetReportDateFilter = () => {
    setReportDateFilters({
      startDate: "",
      endDate: "",
    });
    setAppliedReportDateRange(null);
    setReportRangeTransactions(null);
  };

  const loadInventoryDailySummary = async () => {
    try {
      const summaryRows = await inventoryService.getDailySummary();
      const summaryMap = summaryRows.reduce((acc, row) => {
        acc[row.inventory_item_id] = row;
        return acc;
      }, {} as Record<number, InventoryDailySummary>);
      setInventoryDailySummaryMap(summaryMap);

      setInventoryOpeningInputs((prev) => {
        const next = { ...prev };
        summaryRows.forEach((row) => {
          if (row.opening_inputted !== null && row.opening_inputted !== undefined) {
            const existingValue = (next[row.inventory_item_id] || "").trim();
            if (!existingValue) {
              next[row.inventory_item_id] = String(row.opening_inputted);
            }
          }
        });
        return next;
      });
    } catch (error) {
      console.error("Failed to load inventory daily summary:", error);
      setInventoryDailySummaryMap({});
    }
  };

  const refreshActionRequests = async () => {
    setIsLoadingReturns(true);
    try {
      const requests = await saleService.getActionRequests();
      setReturnsRequests(requests);
    } catch (error) {
      console.error("Failed to load return requests:", error);
      setReturnsRequests([]);
    } finally {
      setIsLoadingReturns(false);
    }
  };

  const getActionRequestErrorMessage = (error: unknown) => {
    const statusCode =
      typeof error === "object" &&
      error !== null &&
      "response" in error
        ? (error as { response?: { status?: number; data?: { message?: string } } }).response
            ?.status
        : undefined;

    if (statusCode === 404 || statusCode === 405) {
      return "Returns approval endpoints are not available yet. Add backend action-request routes to enable refunds and void approval.";
    }

    const responseMessage =
      typeof error === "object" &&
      error !== null &&
      "response" in error
        ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined;

    return responseMessage || "Failed to process returns request.";
  };

  const getSyncErrorMessage = (error: any) => {
    const statusCode = error?.response?.status;
    if (statusCode === 404 || statusCode === 405) {
      return "Offline sync endpoints are not available yet. Add backend routes to enable queue monitoring.";
    }
    return error?.response?.data?.message || "Failed to load offline sync data.";
  };

  const loadSyncMonitor = async (status: SyncQueueStatus | "all") => {
    setIsLoadingSyncQueue(true);
    setSyncLoadError("");

    const queueParams = status === "all" ? undefined : { status };
    const [queueResult, summaryResult, versionResult] = await Promise.allSettled([
      syncService.getQueue(queueParams),
      syncService.getSummary(),
      syncService.getVersion(),
    ]);

    if (queueResult.status === "fulfilled") {
      setSyncEndpointAvailable(true);
      setSyncQueueItems(queueResult.value || []);
    } else {
      console.error("Failed to load sync queue:", queueResult.reason);
      setSyncEndpointAvailable(false);
      setSyncQueueItems([]);
      setSyncSummary(null);
      setSyncVersion("-");
      setSyncLoadError(getSyncErrorMessage(queueResult.reason));
      setIsLoadingSyncQueue(false);
      return;
    }

    if (summaryResult.status === "fulfilled") {
      setSyncSummary(summaryResult.value);
    } else {
      setSyncSummary(null);
    }

    if (versionResult.status === "fulfilled" && versionResult.value?.version) {
      setSyncVersion(versionResult.value.version);
    } else {
      setSyncVersion("-");
    }

    setSyncLastCheckedAt(new Date().toISOString());
    setIsLoadingSyncQueue(false);
  };

  const handleSyncQueueAction = async (
    queueItem: SyncQueueItem,
    action: "retry" | "cancel" | "resolve"
  ) => {
    if (isSyncActionItemId !== null) {
      return;
    }

    setIsSyncActionItemId(queueItem.id);
    try {
      if (action === "retry") {
        await syncService.retryQueueItem(queueItem.id);
      } else if (action === "cancel") {
        const shouldCancel = window.confirm(
          "Cancel this queued transaction? It will stop further sync attempts."
        );
        if (!shouldCancel) {
          return;
        }
        await syncService.cancelQueueItem(queueItem.id);
      } else {
        const resolutionInput =
          (window.prompt("Conflict resolution (retry, cancel, force)", "retry") || "")
            .trim()
            .toLowerCase();
        if (!["retry", "cancel", "force"].includes(resolutionInput)) {
          alert("Resolution must be retry, cancel, or force.");
          return;
        }
        const note = (window.prompt("Optional admin note") || "").trim();
        await syncService.resolveConflict(queueItem.id, {
          resolution: resolutionInput as "retry" | "cancel" | "force",
          note: note || undefined,
        });
      }

      await loadSyncMonitor(syncStatusFilter);
    } catch (error: any) {
      console.error("Failed to process sync action:", error);
      alert(error?.response?.data?.message || "Failed to process sync action.");
    } finally {
      setIsSyncActionItemId(null);
    }
  };

  const loadData = async () => {
    try {
      // Check if user is authenticated
      if (!authService.isAuthenticated()) {
        navigate("/");
        return;
      }

      // Load categories
      const categoriesData = await categoryService.getAll();
      setCategories(categoriesData);

      // Load products
      const productsData = await productService.getAll();
      // Map backend products to frontend FoodItem format
      const mappedItems = productsData.map((p: any) => ({
        id: p.id,
        name: p.name,
        category_id: p.category_id,
        category: p.category?.name || "",
        cost: p.cost,
        price: p.price,
        description: p.description || "",
        image_path: p.image_path || null,
        image_url: p.image_url || null,
      }));
      setItems(mappedItems);

      // Load inventory
      const inventoryData = await inventoryService.getAll();
      setInventory(inventoryData);
      await loadInventoryDailySummary();

      // Load ingredients for all products from backend
      await loadProductIngredients(mappedItems);
      await loadPosSettings();

      // Load sales and returns data for dashboard/reports and returns approval queue
      await loadSalesData();
      await refreshActionRequests();
    } catch (error) {
      console.error("Failed to load data:", error);
      // If unauthorized, redirect to login
      if ((error as any).response?.status === 401) {
        navigate("/");
      }
    }
  };

  useEffect(() => {
    if (currentPage !== "sync") {
      return;
    }
    loadSyncMonitor(syncStatusFilter);
  }, [currentPage, syncStatusFilter]);

  const loadProductIngredients = async (products: FoodItem[]) => {
    const ingredientsMap: { [key: number]: Array<{ inventoryItemId: number; quantity: number }> } = {};
    
    try {
      // Load ingredients for each product
      for (const product of products) {
        const ingredients = await productService.getIngredients(product.id);
        ingredientsMap[product.id] = ingredients.map(ing => ({
          inventoryItemId: ing.inventory_item_id,
          quantity: parseFloat(ing.quantity.toString()),
        }));
      }
    } catch (error) {
      console.error("Failed to load product ingredients:", error);
      // Initialize with empty ingredients if fetch fails
      products.forEach((product) => {
        ingredientsMap[product.id] = [];
      });
    }
    
    setItemIngredients(ingredientsMap);
  };

  const handleLogout = async () => {
    try {
      await authService.logout();
      navigate("/");
    } catch (error) {
      console.error("Logout error:", error);
      navigate("/");
    }
  };

  const togglePaymentMethod = (method: keyof typeof paymentMethods) => {
    setPaymentMethods({ ...paymentMethods, [method]: !paymentMethods[method] });
  };

  const hydratePosSettings = (settings: PosSettings) => {
    setPaymentMethods({
      bank_transfer: !!settings.payment_methods.bank_transfer,
      card: !!settings.payment_methods.card,
      credit: !!settings.payment_methods.credit,
      food_panda: !!settings.payment_methods.food_panda,
      gcash: !!settings.payment_methods.gcash,
      grab: !!settings.payment_methods.grab,
      maya: !!settings.payment_methods.maya,
    });
    setDefaultTaxRate(String(settings.default_tax_rate ?? 0));
    setDefaultDiscountRate(String(settings.default_discount_rate ?? 0));
  };

  const loadPosSettings = async () => {
    try {
      const settings = await settingsService.getPosSettings();
      hydratePosSettings(settings);
    } catch (error) {
      console.error("Failed to load POS settings:", error);
    }
  };

  const savePosSettings = async () => {
    const taxRate = Number(defaultTaxRate);
    const discountRate = Number(defaultDiscountRate);

    if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) {
      alert("Default tax rate must be between 0 and 100.");
      return;
    }

    if (!Number.isFinite(discountRate) || discountRate < 0 || discountRate > 100) {
      alert("Default discount rate must be between 0 and 100.");
      return;
    }

    setIsSavingPosSettings(true);
    try {
      const updated = await settingsService.updatePosSettings({
        payment_methods: {
          cash: true,
          ...paymentMethods,
        },
        default_tax_rate: taxRate,
        default_discount_rate: discountRate,
      });
      hydratePosSettings(updated);
      setShowPaymentMethods(false);
      alert("POS settings saved.");
    } catch (error: any) {
      console.error("Failed to save POS settings:", error);
      alert(error?.response?.data?.message || "Failed to save POS settings.");
    } finally {
      setIsSavingPosSettings(false);
    }
  };

  const addCategory = async () => {
    const name = newCategory.trim();
    if (!name || isAddingCategory) return;

    // prevent duplicated category names (case-insensitive)
    const exists = categories.some(
      (c) => c.name.trim().toLowerCase() === name.toLowerCase()
    );
    if (exists) {
      alert("Category already exists");
      return;
    }

    setIsAddingCategory(true);
    try {
      const newCat = await categoryService.create({
        name,
        description: "",
      });
      setCategories([...categories, newCat]);
      setNewCategory("");
    } catch (error: any) {
      console.error("Failed to add category:", error);
      alert(error.response?.data?.message || "Failed to add category");
    } finally {
      setIsAddingCategory(false);
    }
  };

  const confirmDeleteCategory = async (id: number) => {
    setDeleteConfirmId(null);
    try {
      await categoryService.delete(id);
      setCategories(categories.filter((cat) => cat.id !== id));
      // Also remove items from this category (ensure numeric comparison)
      setItems(
        items.filter((item) => Number(item.category_id) !== id)
      );
    } catch (error: any) {
      console.error("Failed to delete category:", error);
      alert(error.response?.data?.message || "Failed to delete category");
    }
  };

  const confirmEditCategory = async (newName: string) => {
    if (editConfirmData && newName.trim()) {
      try {
        const updatedCat = await categoryService.update(editConfirmData.id, {
          name: newName,
          description: "",
        });
        setCategories(
          categories.map((cat) =>
            cat.id === editConfirmData.id ? updatedCat : cat
          )
        );
        setEditConfirmData(null);
      } catch (error: any) {
        console.error("Failed to update category:", error);
        alert(error.response?.data?.message || "Failed to update category");
      }
    }
  };

  const deleteItem = (id: number) => {
    const item = items.find((item) => item.id === id);
    if (item) {
      setItemDeleteConfirmId(id);
      setDeleteConfirmItemName(item.name);
    }
  };

  const confirmDeleteItem = async (id: number) => {
    try {
      await productService.delete(id);
      setItems(items.filter((item) => item.id !== id));
      setItemDeleteConfirmId(null);
      setDeleteConfirmItemName("");
    } catch (error: any) {
      console.error('Error deleting item:', error);
      alert(error.response?.data?.message || "Failed to delete item");
    }
  };

  const editItemStart = (item: FoodItem) => {
    setEditingItemData({
      id: item.id,
      name: item.name,
      cost: item.cost,
      price: item.price,
    });
  };

  const confirmEditItem = async () => {
    if (!editingItemData) return;
    if (!editingItemData.name.trim() || !editingItemData.cost || !editingItemData.price) {
      return;
    }
    try {
      const updatedItem = await productService.update(editingItemData.id, {
        name: editingItemData.name,
        cost: editingItemData.cost,
        price: editingItemData.price,
        category_id: items.find(i => i.id === editingItemData.id)?.category_id || 1,
        description: items.find(i => i.id === editingItemData.id)?.description || "",
      });

      // Map backend response to frontend format
      setItems(
        items.map((item) =>
          item.id === editingItemData.id
            ? {
                ...item,
                name: updatedItem.name,
                cost: updatedItem.cost,
                price: updatedItem.price,
              }
            : item
        )
      );
      setEditingItemData(null);
    } catch (error: any) {
      console.error('Error updating item:', error);
      alert(error.response?.data?.message || "Failed to update item");
    }
  };

  const startEditingIngredients = (itemId: number) => {
    setEditingIngredientItemId(itemId);
    setTempIngredients([...(itemIngredients[itemId] || [])]);
  };

  const saveItemIngredients = async () => {
    if (editingIngredientItemId !== null) {
      try {
        // Filter out incomplete entries
        const validIngredients = tempIngredients.filter(
          ing => ing.inventoryItemId && ing.quantity > 0
        );

        // Save ingredients to backend
        const ingredientsToSave = validIngredients.map(ing => ({
          inventory_item_id: ing.inventoryItemId,
          quantity: ing.quantity,
        }));

        await productService.saveIngredients(editingIngredientItemId, ingredientsToSave);
        
        // Update state with validated ingredients
        setItemIngredients({ 
          ...itemIngredients, 
          [editingIngredientItemId]: validIngredients 
        });
        
        setEditingIngredientItemId(null);
        setTempIngredients([]);
        
        // Show success message
        alert("Ingredients linked successfully!");
      } catch (error: any) {
        console.error("Error saving ingredients:", error);
        alert(error.response?.data?.message || "Error saving ingredients");
      }
    }
  };

  const addInventoryItem = async () => {
    if (
      isSavingInventory ||
      !newInventoryItem.name.trim() ||
      !newInventoryItem.quantity ||
      !newInventoryItem.unit.trim()
    ) {
      return;
    }

    setIsSavingInventory(true);
    try {
      const newItem = await inventoryService.create({
        name: newInventoryItem.name,
        quantity: parseFloat(newInventoryItem.quantity),
        unit: newInventoryItem.unit,
        reorder_level: 10,
      });
      setInventory([...inventory, newItem]);
      setNewInventoryItem({ name: "", quantity: "", unit: "" });
      await loadInventoryDailySummary();
    } catch (error: any) {
      console.error('Error saving inventory item:', error);
      alert(error.response?.data?.message || "Failed to add inventory item");
    } finally {
      setIsSavingInventory(false);
    }
  };

  const deleteInventoryItem = async (id: number) => {
    try {
      await inventoryService.delete(id);
      setInventory(inventory.filter((item) => item.id !== id));
      setInventoryDailySummaryMap((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setInventoryOpeningInputs((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setExpandedInventoryHistoryIds((prev) => prev.filter((itemId) => itemId !== id));
      setInventoryHistoryByItemId((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (error: any) {
      console.error('Error deleting inventory item:', error);
      alert(error.response?.data?.message || "Failed to delete inventory item");
    }
  };

  const toggleInventoryHistory = async (itemId: number) => {
    const isExpanded = expandedInventoryHistoryIds.includes(itemId);
    if (isExpanded) {
      setExpandedInventoryHistoryIds((prev) => prev.filter((id) => id !== itemId));
      return;
    }

    setExpandedInventoryHistoryIds((prev) => [...prev, itemId]);

    if (inventoryHistoryByItemId[itemId]) {
      return;
    }

    setLoadingInventoryHistoryIds((prev) => [...prev, itemId]);
    try {
      const history = await inventoryService.getMovements(itemId);
      setInventoryHistoryByItemId((prev) => ({
        ...prev,
        [itemId]: [...history].sort(
          (a, b) =>
            new Date(b.created_at || 0).getTime() -
            new Date(a.created_at || 0).getTime()
        ),
      }));
    } catch (error) {
      console.error("Failed to load inventory history:", error);
      setInventoryHistoryByItemId((prev) => ({
        ...prev,
        [itemId]: [],
      }));
    } finally {
      setLoadingInventoryHistoryIds((prev) => prev.filter((id) => id !== itemId));
    }
  };

  const applyOpeningInput = async (item: InventoryItem) => {
    const rawInput = (inventoryOpeningInputs[item.id] || "").trim();
    if (!rawInput) {
      alert("Please enter opening stock first.");
      return;
    }

    const openingValue = Number(rawInput);
    if (!Number.isFinite(openingValue) || openingValue < 0) {
      alert("Opening stock must be a valid non-negative number.");
      return;
    }

    const currentQty = Number(item.quantity || 0);
    const delta = openingValue - currentQty;
    if (Math.abs(delta) < 0.0001) {
      alert("Opening stock matches current quantity. No update needed.");
      return;
    }

    setIsApplyingOpeningItemId(item.id);
    try {
      await inventoryService.addMovement(item.id, {
        movement_type: "adjustment",
        quantity: Number(delta.toFixed(3)),
        notes: "Opening stock reconciliation",
        opening_inputted: openingValue,
      });

      const refreshedInventory = await inventoryService.getAll();
      setInventory(refreshedInventory);
      await loadInventoryDailySummary();

      if (expandedInventoryHistoryIds.includes(item.id)) {
        const refreshedHistory = await inventoryService.getMovements(item.id);
        setInventoryHistoryByItemId((prev) => ({
          ...prev,
          [item.id]: [...refreshedHistory].sort(
            (a, b) =>
              new Date(b.created_at || 0).getTime() -
              new Date(a.created_at || 0).getTime()
          ),
        }));
      }
    } catch (error: any) {
      console.error("Failed to apply opening stock:", error);
      alert(error.response?.data?.message || "Failed to apply opening stock.");
    } finally {
      setIsApplyingOpeningItemId(null);
    }
  };

  const saveInlineItem = async (categoryName: string) => {
    // Prevent duplicate submissions
    if (isSavingItem) {
      return;
    }

    if (inlineItemForm.name.trim() && inlineItemForm.cost && inlineItemForm.price) {
      setIsSavingItem(true);
      try {
        // find category id from current categories
        const categoryObj = categories.find((c) => c.name === categoryName);
        if (!categoryObj) {
          console.error('Category not found for', categoryName);
          setIsSavingItem(false);
          return;
        }

        // Create product via API
        const newProduct = await productService.create({
          name: inlineItemForm.name,
          category_id: categoryObj.id,
          cost: parseFloat(inlineItemForm.cost),
          price: parseFloat(inlineItemForm.price),
          description: '',
        });

        // Map to FoodItem format
        const normalized: FoodItem = {
          id: newProduct.id,
          name: newProduct.name,
          category_id: newProduct.category_id,
          category: categoryObj.name,
          cost: newProduct.cost,
          price: newProduct.price,
          description: newProduct.description || '',
          image_path: newProduct.image_path || null,
          image_url: newProduct.image_url || null,
        };
        setItems([...items, normalized]);
        setInlineItemForm({ name: "", cost: "", price: "" });
        setEditingCategoryId(null);
      } catch (error: any) {
        console.error('Error saving item:', error);
        alert(error.response?.data?.message || "Failed to create item");
      } finally {
        setIsSavingItem(false);
      }
    }
  };

  const getSaleReferenceById = (saleId: number) => {
    const sale = salesForReturns.find((row) => row.id === saleId);
    return sale?.public_reference || `#${String(saleId).padStart(5, "0")}`;
  };

  const submitActionRequest = async () => {
    if (isSubmittingReturnRequest) {
      return;
    }

    const saleReference = newActionRequest.saleReference.trim();
    const reason = newActionRequest.reason.trim();
    if (!saleReference || !reason) {
      alert("Sale reference and reason are required.");
      return;
    }

    const matchedSale = salesForReturns.find(
      (sale) => sale.public_reference.toLowerCase() === saleReference.toLowerCase()
    );

    if (!matchedSale) {
      alert("Sale reference not found.");
      return;
    }

    const parsedAmount = Number(newActionRequest.requestedAmount || 0);
    if (newActionRequest.actionType === "refund") {
      if (!newActionRequest.requestedAmount || parsedAmount <= 0) {
        alert("Refund amount must be greater than 0.");
        return;
      }
      if (parsedAmount > Number(matchedSale.total || 0)) {
        alert("Refund amount cannot exceed sale total.");
        return;
      }
    }

    setIsSubmittingReturnRequest(true);
    try {
      await saleService.requestAction(matchedSale.id, {
        action_type: newActionRequest.actionType,
        reason,
        requested_amount:
          newActionRequest.actionType === "refund"
            ? parsedAmount
            : undefined,
      });
      alert("Request submitted for admin review.");
      setNewActionRequest({
        saleReference,
        actionType: newActionRequest.actionType,
        reason: "",
        requestedAmount: "",
      });
      await refreshActionRequests();
    } catch (error: unknown) {
      console.error("Failed to submit action request:", error);
      alert(getActionRequestErrorMessage(error));
    } finally {
      setIsSubmittingReturnRequest(false);
    }
  };

  const reviewActionRequest = async (
    requestId: number,
    decision: "approved" | "rejected"
  ) => {
    if (isReviewingRequestId) {
      return;
    }

    const promptMessage =
      decision === "approved"
        ? "Optional approval note"
        : "Rejection reason (required)";
    const decisionNote = window.prompt(promptMessage) || "";
    if (decision === "rejected" && !decisionNote.trim()) {
      alert("Rejection reason is required.");
      return;
    }

    setIsReviewingRequestId(requestId);
    try {
      await saleService.reviewActionRequest(requestId, {
        decision,
        note: decisionNote.trim() || undefined,
      });
      await refreshActionRequests();
      await loadSalesData();
    } catch (error: unknown) {
      console.error("Failed to review action request:", error);
      alert(getActionRequestErrorMessage(error));
    } finally {
      setIsReviewingRequestId(null);
    }
  };

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: "DB" },
    { id: "items", label: "Items", icon: "IT" },
    { id: "inventory", label: "Inventory", icon: "INV" },
    { id: "reports", label: "Reports", icon: "RPT" },
    { id: "receipts", label: "Receipts", icon: "REC" },
    { id: "returns", label: "Returns", icon: "RTN" },
    { id: "sync", label: "Offline Sync", icon: "SYNC" },
  ];

  // Reports helper functions
  const getDailyTransactions = () => {
    const scopedTransactions = reportRangeTransactions ?? todayTransactions;
    return [...scopedTransactions]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  const getDailyTotalRevenue = () => {
    if (reportRangeTransactions !== null) {
      return getDailyTransactions().reduce((sum, t) => sum + t.amount, 0);
    }

    if (dailySalesSummary) {
      return Number(dailySalesSummary.total_revenue || 0);
    }
    return todayTransactions.reduce((sum, t) => sum + t.amount, 0);
  };

  const getDailyTotalTransactions = () => {
    if (reportRangeTransactions !== null) {
      return getDailyTransactions().length;
    }

    if (dailySalesSummary) {
      return Number(dailySalesSummary.total_transactions || 0);
    }
    return todayTransactions.length;
  };

  const getMonthlyScopedTransactions = () => {
    if (reportRangeTransactions !== null) {
      return [...reportRangeTransactions];
    }

    const now = new Date();
    return transactions.filter(
      (t) =>
        new Date(t.date).getMonth() === now.getMonth() &&
        new Date(t.date).getFullYear() === now.getFullYear()
    );
  };

  const getMonthlyTotalTransactions = () => {
    return getMonthlyScopedTransactions().length;
  };

  const getItemImageUrl = (item: FoodItem) => {
    const securedPreviewUrl = itemImagePreviewUrls[item.id];
    if (securedPreviewUrl) {
      return securedPreviewUrl;
    }

    // Allow direct public URLs when present (e.g., CDN/static).
    if (item.image_url && /^https?:\/\//i.test(item.image_url)) {
      return item.image_url;
    }

    return "";
  };

  const getItemImageInputId = (itemId: number) => `item-image-input-${itemId}`;

  const openItemImagePicker = (itemId: number) => {
    const input = document.getElementById(getItemImageInputId(itemId)) as HTMLInputElement | null;
    if (input) {
      input.click();
    }
  };

  const uploadItemImage = async (item: FoodItem, file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("Please select a valid image file.");
      return;
    }

    const maxBytes = 5 * 1024 * 1024;
    if (file.size > maxBytes) {
      alert("Image must be 5MB or smaller.");
      return;
    }

    setIsUploadingImageItemId(item.id);
    try {
      const existingPreview = itemImagePreviewUrlsRef.current[item.id];
      if (existingPreview) {
        URL.revokeObjectURL(existingPreview);
        setItemImagePreviewUrls((current) => {
          const next = { ...current };
          delete next[item.id];
          return next;
        });
      }
      loadingItemImageIdsRef.current.delete(item.id);

      const responseData = await productImageService.uploadImage(item.id, file);
      const productFromResponse = responseData?.product || {};
      const uploadedImagePath = responseData?.image_path ?? productFromResponse?.image_path ?? item.image_path ?? null;
      const uploadedImageUrl = responseData?.image_url ?? productFromResponse?.image_url ?? item.image_url ?? null;
      const cacheBustedUrl = uploadedImageUrl
        ? `${uploadedImageUrl}${uploadedImageUrl.includes("?") ? "&" : "?"}t=${Date.now()}`
        : null;

      // Fetch canonical product payload after upload so the persisted image fields stay in sync.
      let refreshedProduct: any = null;
      try {
        refreshedProduct = await productService.getById(item.id);
      } catch (refreshError) {
        console.warn("Failed to refresh product after image upload, using upload response fallback.", refreshError);
      }

      const persistedImagePath = refreshedProduct?.image_path ?? uploadedImagePath;
      const persistedImageUrl =
        refreshedProduct?.image_url ??
        productFromResponse?.image_url ??
        uploadedImageUrl;
      const finalImageUrl = persistedImageUrl
        ? `${persistedImageUrl}${persistedImageUrl.includes("?") ? "&" : "?"}t=${Date.now()}`
        : cacheBustedUrl || uploadedImageUrl;

      setItems((current) =>
        current.map((row) =>
          row.id === item.id
            ? {
                ...row,
                image_path: persistedImagePath,
                image_url: finalImageUrl,
              }
            : row
        )
      );

      // Immediately fetch the protected image as blob so preview works with auth-protected routes.
      try {
        const imageResponse = await apiClient.get(`/products/${item.id}/image`, {
          responseType: "blob",
        });
        const objectUrl = URL.createObjectURL(imageResponse.data as Blob);
        setItemImagePreviewUrls((current) => {
          const previous = current[item.id];
          if (previous) {
            URL.revokeObjectURL(previous);
          }
          return {
            ...current,
            [item.id]: objectUrl,
          };
        });
      } catch (previewError) {
        console.warn("Uploaded image saved but preview fetch failed.", previewError);
      }
    } catch (error: any) {
      console.error("Failed to upload product image:", error);
      const message =
        error?.message ||
        error?.error ||
        error?.response?.data?.message ||
        "Failed to upload image.";
      alert(message);
    } finally {
      setIsUploadingImageItemId(null);
      setDragOverImageItemId(null);
    }
  };

  const shiftReceiptPickerMonth = (field: ReportDateField, delta: number) => {
    setReceiptPickerMonth((current) => ({
      ...current,
      [field]: new Date(
        current[field].getFullYear(),
        current[field].getMonth() + delta,
        1
      ),
    }));
  };

  const setReceiptPickerMonthAndYear = (
    field: ReportDateField,
    month: number,
    year: number
  ) => {
    setReceiptPickerMonth((current) => ({
      ...current,
      [field]: new Date(year, month, 1),
    }));
  };

  const setReceiptDateField = (field: ReportDateField, value: string) => {
    setReceiptFilters((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const openCustomReceiptDatePicker = (field: ReportDateField) => {
    const selectedIso = receiptFilters[field];
    const seed = selectedIso ? parseLocalIsoDate(selectedIso) : new Date();
    setReceiptPickerMonth((current) => ({
      ...current,
      [field]: new Date(seed.getFullYear(), seed.getMonth(), 1),
    }));
    setOpenReceiptDatePicker(field);
  };

  const renderReceiptDateField = (
    field: ReportDateField,
    id: string,
    placeholderLabel: string
  ) => {
    const selectedIso = receiptFilters[field];
    const selectedDisplay = selectedIso
      ? formatIsoDateForDisplay(selectedIso)
      : placeholderLabel;
    const monthCursor = receiptPickerMonth[field];
    const dayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
    const cells = getReportCalendarDays(monthCursor);
    const isOpen = openReceiptDatePicker === field;

    return (
      <div
        className="report-filter-field receipts-date-field"
        ref={isOpen ? receiptDatePickerRef : undefined}
      >
        <button
          type="button"
          id={id}
          className="report-date-trigger"
          onClick={() =>
            isOpen ? setOpenReceiptDatePicker(null) : openCustomReceiptDatePicker(field)
          }
          aria-expanded={isOpen}
          aria-label={placeholderLabel}
        >
          {selectedDisplay}
        </button>

        {isOpen && (
          <div className="report-date-popup" role="dialog" aria-label={`${placeholderLabel} calendar`}>
            <div className="report-date-popup-header">
              <button
                type="button"
                className="report-date-nav-btn"
                onClick={() => shiftReceiptPickerMonth(field, -1)}
                aria-label="Previous month"
              >
                Prev
              </button>
              <div className="report-date-month-label">{formatMonthLabel(monthCursor)}</div>
              <button
                type="button"
                className="report-date-nav-btn"
                onClick={() => shiftReceiptPickerMonth(field, 1)}
                aria-label="Next month"
              >
                Next
              </button>
            </div>
            <div className="report-date-jump-controls">
              <select
                className="report-date-select"
                value={monthCursor.getMonth()}
                onChange={(event) =>
                  setReceiptPickerMonthAndYear(
                    field,
                    Number(event.target.value),
                    monthCursor.getFullYear()
                  )
                }
                aria-label="Select month"
              >
                {REPORT_CALENDAR_MONTHS.map((monthName, index) => (
                  <option key={`receipt-${monthName}-${index}`} value={index}>
                    {monthName}
                  </option>
                ))}
              </select>
              <select
                className="report-date-select report-date-year-select"
                value={monthCursor.getFullYear()}
                onChange={(event) =>
                  setReceiptPickerMonthAndYear(
                    field,
                    monthCursor.getMonth(),
                    Number(event.target.value)
                  )
                }
                aria-label="Select year"
              >
                {REPORT_CALENDAR_YEARS.map((year) => (
                  <option key={`receipt-year-${year}`} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
            <div className="report-date-grid report-date-grid-days">
              {dayNames.map((day) => (
                <div key={`receipt-${field}-${day}`} className="report-date-day-name">
                  {day}
                </div>
              ))}
            </div>
            <div className="report-date-grid">
              {cells.map((cell) => {
                const cellIso = toLocalIsoDate(cell.date);
                const isSelected = selectedIso === cellIso;
                return (
                  <button
                    key={`receipt-${field}-${cellIso}`}
                    type="button"
                    className={`report-date-cell ${isSelected ? "selected" : ""} ${cell.isCurrentMonth ? "" : "outside-month"}`}
                    onClick={() => {
                      setReceiptDateField(field, cellIso);
                      setOpenReceiptDatePicker(null);
                    }}
                    title={formatIsoDateForDisplay(cellIso)}
                  >
                    <span>{cell.date.getDate()}</span>
                    {!cell.isCurrentMonth && (
                      <small>{cell.date.toLocaleDateString("en-US", { month: "short" })}</small>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="report-date-popup-actions">
              <button
                type="button"
                className="report-date-link-btn"
                onClick={() => setReceiptDateField(field, "")}
              >
                Clear
              </button>
              <button
                type="button"
                className="report-date-link-btn"
                onClick={() => {
                  setReceiptDateField(field, toLocalIsoDate(new Date()));
                  setOpenReceiptDatePicker(null);
                }}
              >
                Today
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const getSalesReportTransactions = () => {
    return [...getMonthlyScopedTransactions()].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  };

  const getAverageDailySales = () => {
    if (reportRangeTransactions !== null && appliedReportDateRange) {
      const startDate = new Date(`${appliedReportDateRange.startDate}T00:00:00`);
      const endDate = new Date(`${appliedReportDateRange.endDate}T00:00:00`);
      const msPerDay = 24 * 60 * 60 * 1000;
      const dayCount = Math.max(1, Math.floor((endDate.getTime() - startDate.getTime()) / msPerDay) + 1);
      const scopedRevenue = getMonthlyTotalRevenue();
      return scopedRevenue / dayCount;
    }

    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const monthlyRevenue = getMonthlyTotalRevenue();
    return monthlyRevenue / daysInMonth;
  };

  const getReportScopeRange = () => {
    if (appliedReportDateRange) {
      return appliedReportDateRange;
    }
    const now = new Date();
    return {
      startDate: toLocalIsoDate(new Date(now.getFullYear(), now.getMonth(), 1)),
      endDate: toLocalIsoDate(now),
    };
  };

  const reportableSalesForAnalytics = salesForReturns
    .filter(isSaleReportable)
    .filter((sale) => isSaleInsideDateRange(sale, getReportScopeRange()));

  const getBestSellingItem = () => {
    const itemCounts = reportableSalesForAnalytics.reduce((acc, sale) => {
      const saleItems = getSaleLineItems(sale);
      if (!Array.isArray(saleItems) || saleItems.length === 0) {
        return acc;
      }

      saleItems.forEach((line) => {
        const lineName = line.name || `Item-${line.product_id}`;
        acc[lineName] = (acc[lineName] || 0) + Number(line.quantity || 0);
      });
      return acc;
    }, {} as Record<string, number>);

    const bestItem = Object.entries(itemCounts).sort(([, a], [, b]) => b - a)[0];
    return bestItem ? { name: bestItem[0], quantity: bestItem[1] } : null;
  };

  const getPaymentBreakdown = () => {
    const breakdown = getSalesReportTransactions()
      .reduce(
        (acc, t) => {
          acc[t.paymentMethod] = (acc[t.paymentMethod] || 0) + t.amount;
          return acc;
        },
        {} as Record<string, number>
      );
    return Object.entries(breakdown).map(([method, amount]) => ({
      method,
      amount,
    }));
  };

  const getMonthlyTotalRevenue = () => {
    return getMonthlyScopedTransactions().reduce((sum, t) => sum + t.amount, 0);
  };

  const getMonthlyPerformance = () => {
    if (reportRangeTransactions !== null && appliedReportDateRange) {
      const bucket = reportRangeTransactions.reduce((acc, transaction) => {
        const dateKey = toLocalIsoDate(new Date(transaction.date));
        acc[dateKey] = (acc[dateKey] || 0) + transaction.amount;
        return acc;
      }, {} as Record<string, number>);

      return Object.entries(bucket)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([label, amount]) => ({
          label,
          amount,
        }));
    }

    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dailyRevenue: Record<number, number> = {};

    for (let i = 1; i <= daysInMonth; i++) {
      dailyRevenue[i] = 0;
    }

    transactions.forEach((t) => {
      const transDate = new Date(t.date);
      if (
        transDate.getMonth() === now.getMonth() &&
        transDate.getFullYear() === now.getFullYear()
      ) {
        const day = transDate.getDate();
        dailyRevenue[day] = (dailyRevenue[day] || 0) + t.amount;
      }
    });

    return Object.entries(dailyRevenue).map(([day, amount]) => ({
      label: `Day ${parseInt(day)}`,
      amount,
    }));
  };

  const getMostProfitableItem = () => {
    const itemProfit = items.reduce((acc, item) => {
      const profitPerUnit = Number(item.price) - Number(item.cost);
      const unitsSold = reportableSalesForAnalytics.reduce((sum, sale) => {
        const saleItems = getSaleLineItems(sale);
        if (!Array.isArray(saleItems) || saleItems.length === 0) {
          return sum;
        }

        return (
          sum +
          saleItems
            .filter((line) => Number(line.product_id) === item.id)
            .reduce((lineSum, line) => lineSum + Number(line.quantity || 0), 0)
        );
      }, 0);

      acc[item.name] = profitPerUnit * unitsSold;
      return acc;
    }, {} as Record<string, number>);

    const mostProfitable = Object.entries(itemProfit).sort(([, a], [, b]) => b - a)[0];
    return mostProfitable ? { name: mostProfitable[0], profit: mostProfitable[1] } : null;
  };

  const getLowStockItems = () => {
    return inventory.filter((item) => item.quantity < 10 && item.quantity > 0);
  };

  const getOutOfStockItems = () => {
    return inventory.filter((item) => item.quantity === 0);
  };

  const uniqueCustomersCount = new Set(
    salesForReturns
      .map((sale) => sale.customer_id)
      .filter((customerId): customerId is number => typeof customerId === "number")
  ).size;

  // Count only items with valid categories (to match what displays on items page)
  const displayedItemsCount = items.filter((item) => item.category && item.category.trim()).length;

  const formatMoney = (value: number) => `PHP ${Number(value || 0).toFixed(2)}`;

  const formatDateLabel = (isoDate: string) => {
    const parsed = new Date(`${isoDate}T12:00:00`);
    if (Number.isNaN(parsed.getTime())) {
      return isoDate;
    }
    return parsed.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatPercent = (value: number | null) =>
    value === null || !Number.isFinite(value) ? "-" : `${value.toFixed(2)}%`;

  const getDefaultReportRange = (reportType: ReportViewType): ReportRange => {
    const today = new Date();
    const endDate = toLocalIsoDate(today);
    if (reportType === "daily") {
      return {
        startDate: endDate,
        endDate,
      };
    }

    return {
      startDate: toLocalIsoDate(new Date(today.getFullYear(), today.getMonth(), 1)),
      endDate,
    };
  };

  const getEffectiveReportRange = (reportType: ReportViewType): ReportRange => {
    return appliedReportDateRange ?? getDefaultReportRange(reportType);
  };

  const getRangeDayCount = (range: ReportRange) => {
    const start = new Date(`${range.startDate}T00:00:00`);
    const end = new Date(`${range.endDate}T00:00:00`);
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.max(1, Math.floor((end.getTime() - start.getTime()) / msPerDay) + 1);
  };

  const getPreviousReportRange = (range: ReportRange): ReportRange => {
    const dayCount = getRangeDayCount(range);
    const start = new Date(`${range.startDate}T00:00:00`);
    const prevEnd = new Date(start);
    prevEnd.setDate(prevEnd.getDate() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - (dayCount - 1));
    return {
      startDate: toLocalIsoDate(prevStart),
      endDate: toLocalIsoDate(prevEnd),
    };
  };

  const safePercentChange = (current: number, previous: number): number | null => {
    if (Math.abs(previous) < 0.000001) {
      return current === 0 ? 0 : null;
    }
    return ((current - previous) / previous) * 100;
  };

  const getReportableSalesInRange = (range: ReportRange) => {
    return salesForReturns
      .filter(isSaleReportable)
      .filter((sale) => isSaleInsideDateRange(sale, range));
  };

  const buildReportPayload = (reportType: ReportViewType): ReportPayload => {
    const currentRange = getEffectiveReportRange(reportType);
    const previousRange = getPreviousReportRange(currentRange);
    const scopedSales = getReportableSalesInRange(currentRange);
    const previousSales = getReportableSalesInRange(previousRange);
    const itemById = new Map(items.map((item) => [item.id, item]));

    const periodLabel = `${formatDateLabel(currentRange.startDate)} to ${formatDateLabel(
      currentRange.endDate
    )}`;
    const comparisonLabel = `${formatDateLabel(previousRange.startDate)} to ${formatDateLabel(
      previousRange.endDate
    )}`;

    const paymentMap: Record<string, number> = {};
    const categoryMap: Record<string, ReportCategoryRow> = {};
    const productMap: Record<string, ReportProductRow> = {};
    const compareMap: Record<
      string,
      { period1Qty: number; period1Revenue: number; period2Qty: number; period2Revenue: number }
    > = {};
    const dailyTrendMap: Record<string, number> = {};
    const transactions = scopedSales
      .map((sale) => {
        const saleItems = getSaleLineItems(sale);
        const paymentList = getSalePayments(sale);
        const paymentMethod =
          Array.isArray(paymentList) && paymentList.length > 0
            ? String(paymentList[0]?.method || "cash")
            : "cash";
        const itemCount = Array.isArray(saleItems)
          ? saleItems.reduce((sum, line) => sum + Number(line.quantity || 0), 0)
          : 0;

        return {
          reference: sale.public_reference || getReceiptReferenceDisplay(sale),
          dateTime: sale.created_at
            ? new Date(sale.created_at).toLocaleString()
            : "-",
          paymentMethod,
          items: itemCount,
          netTotal: getSaleNetTotal(sale),
          sale,
        };
      })
      .sort(
        (a, b) =>
          new Date(a.sale.created_at || 0).getTime() -
          new Date(b.sale.created_at || 0).getTime()
      );

    const grossRevenue = scopedSales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
    const netRevenue = scopedSales.reduce((sum, sale) => sum + getSaleNetTotal(sale), 0);
    const refundAdjustments = grossRevenue - netRevenue;
    const totalTransactions = scopedSales.length;
    const totalItems = transactions.reduce((sum, row) => sum + row.items, 0);

    let cogs = 0;
    scopedSales.forEach((sale) => {
      const saleItems = getSaleLineItems(sale);
      saleItems.forEach((line: any) => {
        const productId = Number(line.product_id || 0);
        const qty = Number(line.quantity || 0);
        const unitPrice = Number(line.unit_price || 0);
        const lineRevenue = Number.isFinite(Number(line.line_total))
          ? Number(line.line_total)
          : qty * unitPrice;
        const mappedItem = itemById.get(productId);
        const fallbackName = mappedItem?.name || `Item-${productId || "Unknown"}`;
        const lineName = String(line.name || fallbackName);
        const unitCostFromLine = Number(line.cost);
        const unitCostFromCatalog = Number(mappedItem?.cost || 0);
        const unitCost = Number.isFinite(unitCostFromLine) && unitCostFromLine > 0
          ? unitCostFromLine
          : unitCostFromCatalog;
        const lineCogs = unitCost * qty;
        const lineProfit = lineRevenue - lineCogs;
        cogs += lineCogs;

        const categoryName = String(mappedItem?.category || "Uncategorized");
        if (!categoryMap[categoryName]) {
          categoryMap[categoryName] = {
            category: categoryName,
            quantity: 0,
            revenue: 0,
            cogs: 0,
            grossProfit: 0,
            revenueSharePct: 0,
          };
        }
        categoryMap[categoryName].quantity += qty;
        categoryMap[categoryName].revenue += lineRevenue;
        categoryMap[categoryName].cogs += lineCogs;
        categoryMap[categoryName].grossProfit += lineProfit;

        if (!productMap[lineName]) {
          productMap[lineName] = {
            product: lineName,
            quantity: 0,
            revenue: 0,
            cogs: 0,
            grossProfit: 0,
            grossMarginPct: 0,
          };
        }
        productMap[lineName].quantity += qty;
        productMap[lineName].revenue += lineRevenue;
        productMap[lineName].cogs += lineCogs;
        productMap[lineName].grossProfit += lineProfit;
      });

      const paymentMethod = transactions.find((row) => row.reference === (sale.public_reference || getReceiptReferenceDisplay(sale)))?.paymentMethod || "cash";
      paymentMap[paymentMethod] = (paymentMap[paymentMethod] || 0) + getSaleNetTotal(sale);

      if (sale.created_at) {
        const dayKey = toLocalIsoDate(new Date(sale.created_at));
        dailyTrendMap[dayKey] = (dailyTrendMap[dayKey] || 0) + getSaleNetTotal(sale);
      }
    });

    const buildCompareAccumulator = (
      targetSales: Sale[],
      keyQty: "period1Qty" | "period2Qty",
      keyRevenue: "period1Revenue" | "period2Revenue"
    ) => {
      targetSales.forEach((sale) => {
        const saleItems = getSaleLineItems(sale);
        saleItems.forEach((line: any) => {
          const productId = Number(line.product_id || 0);
          const qty = Number(line.quantity || 0);
          const unitPrice = Number(line.unit_price || 0);
          const lineRevenue = Number.isFinite(Number(line.line_total))
            ? Number(line.line_total)
            : qty * unitPrice;
          const mappedItem = itemById.get(productId);
          const lineName = String(line.name || mappedItem?.name || `Item-${productId || "Unknown"}`);
          if (!compareMap[lineName]) {
            compareMap[lineName] = {
              period1Qty: 0,
              period1Revenue: 0,
              period2Qty: 0,
              period2Revenue: 0,
            };
          }
          compareMap[lineName][keyQty] += qty;
          compareMap[lineName][keyRevenue] += lineRevenue;
        });
      });
    };

    buildCompareAccumulator(scopedSales, "period1Qty", "period1Revenue");
    buildCompareAccumulator(previousSales, "period2Qty", "period2Revenue");

    const grossProfit = netRevenue - cogs;
    const grossMarginPct = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;
    const dayCount = getRangeDayCount(currentRange);
    const averageDailySales = dayCount > 0 ? netRevenue / dayCount : 0;

    const paymentBreakdown = Object.entries(paymentMap)
      .map(([method, amount]) => ({
        method,
        amount,
        sharePct: netRevenue > 0 ? (amount / netRevenue) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    const categories = Object.values(categoryMap)
      .map((row) => ({
        ...row,
        revenueSharePct: netRevenue > 0 ? (row.revenue / netRevenue) * 100 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const topProducts = Object.values(productMap)
      .map((row) => ({
        ...row,
        grossMarginPct: row.revenue > 0 ? (row.grossProfit / row.revenue) * 100 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 20);

    const comparisonProducts = Object.entries(compareMap)
      .map(([product, row]) => ({
        product,
        period1Qty: row.period1Qty,
        period1Revenue: row.period1Revenue,
        period2Qty: row.period2Qty,
        period2Revenue: row.period2Revenue,
        qtyChangePct: safePercentChange(row.period1Qty, row.period2Qty),
        revenueChange: row.period1Revenue - row.period2Revenue,
        revenueChangePct: safePercentChange(row.period1Revenue, row.period2Revenue),
      }))
      .sort((a, b) => Math.abs(b.revenueChange) - Math.abs(a.revenueChange))
      .slice(0, 25);

    const dailyTrend = Object.entries(dailyTrendMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, revenue]) => ({ label, revenue }));

    return {
      reportType,
      title:
        reportType === "daily"
          ? "Daily Sales & Profitability Report"
          : "Monthly Sales & Profitability Report",
      subtitle: "La Tia Fanny POS",
      generatedAt: new Date().toLocaleString(),
      period: currentRange,
      periodLabel,
      comparisonLabel,
      totalTransactions,
      totalItems,
      grossRevenue,
      refundAdjustments,
      netRevenue,
      cogs,
      grossProfit,
      grossMarginPct,
      averageDailySales,
      paymentBreakdown,
      categories,
      topProducts,
      comparisonProducts,
      dailyTrend,
      transactions: transactions.map((row) => ({
        reference: row.reference,
        dateTime: row.dateTime,
        paymentMethod: row.paymentMethod,
        items: row.items,
        netTotal: row.netTotal,
      })),
    };
  };

  const exportReportToExcel = async (reportType: ReportViewType) => {
    const payload = buildReportPayload(reportType);
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Report", {
        views: [{ state: "frozen", ySplit: 1 }],
      });

      worksheet.columns = [
        { width: 44 },
        { width: 24 },
        { width: 16 },
        { width: 24 },
        { width: 16 },
        { width: 16 },
        { width: 16 },
        { width: 16 },
      ];

      const thinBorder = {
        top: { style: "thin" as const, color: { argb: "FFD9D9D9" } },
        left: { style: "thin" as const, color: { argb: "FFD9D9D9" } },
        bottom: { style: "thin" as const, color: { argb: "FFD9D9D9" } },
        right: { style: "thin" as const, color: { argb: "FFD9D9D9" } },
      };

      const addSectionTitle = (title: string) => {
        const row = worksheet.addRow([title]);
        worksheet.mergeCells(`A${row.number}:H${row.number}`);
        const cell = worksheet.getCell(`A${row.number}`);
        cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF2F4050" },
        };
        cell.alignment = { vertical: "middle", horizontal: "left" };
        row.height = 22;
      };

      const addHeaderRow = (values: Array<string>) => {
        const row = worksheet.addRow(values);
        row.eachCell((cell) => {
          cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF6D8299" },
          };
          cell.border = thinBorder;
          cell.alignment = { vertical: "middle", horizontal: "left" };
        });
      };

      const addDataRow = (
        values: Array<string | number>,
        options?: { currencyCols?: number[]; percentCols?: number[]; emphasize?: boolean }
      ) => {
        const row = worksheet.addRow(values);
        row.eachCell((cell, colNumber) => {
          cell.border = thinBorder;
          cell.alignment = {
            vertical: "middle",
            horizontal: colNumber === 1 ? "left" : "right",
          };

          if (options?.currencyCols?.includes(colNumber) && typeof cell.value === "number") {
            cell.numFmt = '"PHP" #,##0.00';
          }
          if (options?.percentCols?.includes(colNumber) && typeof cell.value === "number") {
            cell.numFmt = "0.00%";
            cell.value = Number(cell.value) / 100;
          }
          if (options?.emphasize) {
            cell.font = { bold: true };
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFEFF6E7" },
            };
          }
        });
      };

      const addSpacer = () => worksheet.addRow([]);

      const titleRow = worksheet.addRow([payload.title]);
      worksheet.mergeCells(`A${titleRow.number}:H${titleRow.number}`);
      const titleCell = worksheet.getCell(`A${titleRow.number}`);
      titleCell.font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
      titleCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF9A6A3A" },
      };
      titleCell.alignment = { vertical: "middle", horizontal: "left" };
      titleRow.height = 28;

      const subtitleRow = worksheet.addRow([payload.subtitle]);
      worksheet.mergeCells(`A${subtitleRow.number}:H${subtitleRow.number}`);
      const subtitleCell = worksheet.getCell(`A${subtitleRow.number}`);
      subtitleCell.font = { italic: true, color: { argb: "FF555555" } };
      subtitleCell.alignment = { vertical: "middle", horizontal: "left" };

      addDataRow(["Period", payload.periodLabel], { emphasize: true });
      addDataRow(["Compared Against", payload.comparisonLabel], { emphasize: true });
      addDataRow(["Generated At", payload.generatedAt], { emphasize: true });
      addSpacer();

      addSectionTitle("SUMMARY");
      addHeaderRow(["Metric", "Value"]);
      addDataRow(["Transactions", payload.totalTransactions]);
      addDataRow(["Items Sold", payload.totalItems]);
      addDataRow(["Gross Revenue", payload.grossRevenue], { currencyCols: [2] });
      addDataRow(["Refund Adjustments", payload.refundAdjustments], { currencyCols: [2] });
      addDataRow(["Net Revenue", payload.netRevenue], { currencyCols: [2], emphasize: true });
      addDataRow(["COGS (Cost of Goods Sold)", payload.cogs], { currencyCols: [2], emphasize: true });
      addDataRow(["Gross Profit", payload.grossProfit], { currencyCols: [2], emphasize: true });
      addDataRow(["Gross Margin %", payload.grossMarginPct], { percentCols: [2], emphasize: true });
      addDataRow(["Average Daily Sales", payload.averageDailySales], { currencyCols: [2] });
      addSpacer();

      addSectionTitle("PAYMENT MIX");
      addHeaderRow(["Method", "Amount", "Share %"]);
      payload.paymentBreakdown.forEach((row) => {
        addDataRow([row.method, row.amount, row.sharePct], {
          currencyCols: [2],
          percentCols: [3],
        });
      });
      addSpacer();

      addSectionTitle("CATEGORY PERFORMANCE");
      addHeaderRow(["Category", "Qty", "Revenue", "COGS (Cost of Goods Sold)", "Gross Profit", "Revenue Share %"]);
      payload.categories.forEach((row) => {
        addDataRow(
          [row.category, row.quantity, row.revenue, row.cogs, row.grossProfit, row.revenueSharePct],
          { currencyCols: [3, 4, 5], percentCols: [6] }
        );
      });
      addSpacer();

      addSectionTitle("PRODUCT PERFORMANCE (TOP 20)");
      addHeaderRow(["Product", "Qty", "Revenue", "COGS (Cost of Goods Sold)", "Gross Profit", "Gross Margin %"]);
      payload.topProducts.forEach((row) => {
        addDataRow(
          [row.product, row.quantity, row.revenue, row.cogs, row.grossProfit, row.grossMarginPct],
          { currencyCols: [3, 4, 5], percentCols: [6] }
        );
      });
      addSpacer();

      addSectionTitle("COMPARATIVE PRODUCT ANALYSIS");
      addHeaderRow([
        "Product",
        "Current Qty",
        "Previous Qty",
        "Qty Change %",
        "Current Revenue",
        "Previous Revenue",
        "Revenue Change",
        "Revenue Change %",
      ]);
      payload.comparisonProducts.forEach((row) => {
        addDataRow(
          [
            row.product,
            row.period1Qty,
            row.period2Qty,
            row.qtyChangePct === null ? "N/A" : row.qtyChangePct,
            row.period1Revenue,
            row.period2Revenue,
            row.revenueChange,
            row.revenueChangePct === null ? "N/A" : row.revenueChangePct,
          ],
          { currencyCols: [5, 6, 7], percentCols: [4, 8] }
        );
      });
      addSpacer();

      addSectionTitle("DAILY TREND");
      addHeaderRow(["Date", "Revenue"]);
      payload.dailyTrend.forEach((row) => {
        addDataRow([formatDateLabel(row.label), row.revenue], { currencyCols: [2] });
      });
      addSpacer();

      addSectionTitle("TRANSACTION LEDGER");
      addHeaderRow(["Reference", "Date Time", "Payment Method", "Items", "Net Total"]);
      payload.transactions.forEach((row) => {
        addDataRow([row.reference, row.dateTime, row.paymentMethod, row.items, row.netTotal], {
          currencyCols: [5],
        });
      });

      const filePrefix = reportType === "daily" ? "Daily" : "Monthly";
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${filePrefix}_Report_${payload.period.startDate}_to_${payload.period.endDate}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to export Excel report:", error);
      alert("Failed to export Excel report.");
    }
  };

  const getUnifiedReportType = (): ReportViewType => {
    const range = getEffectiveReportRange("monthly");
    return range.startDate === range.endDate ? "daily" : "monthly";
  };

  const toPdfHtmlTable = (headers: string[], body: Array<Array<string | number>>) => {
    const headHtml = headers.map((header) => `<th>${header}</th>`).join("");
    const bodyHtml = body
      .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`)
      .join("");
    return `
      <table class="report-table">
        <thead><tr>${headHtml}</tr></thead>
        <tbody>${bodyHtml}</tbody>
      </table>
    `;
  };

  const encodeHtml = (value: string | number) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const exportReportToPDF = (reportType: ReportViewType) => {
    const payload = buildReportPayload(reportType);
    const reportWindow = window.open("", "_blank", "width=1200,height=900");
    if (!reportWindow) {
      alert("Popup blocked. Please allow popups to export PDF.");
      return;
    }

    const summaryRows = [
      ["Transactions", encodeHtml(payload.totalTransactions)],
      ["Items Sold", encodeHtml(payload.totalItems)],
      ["Gross Revenue", encodeHtml(formatMoney(payload.grossRevenue))],
      ["Refund Adjustments", encodeHtml(formatMoney(payload.refundAdjustments))],
      ["Net Revenue", encodeHtml(formatMoney(payload.netRevenue))],
      ["COGS (Cost of Goods Sold)", encodeHtml(formatMoney(payload.cogs))],
      ["Gross Profit", encodeHtml(formatMoney(payload.grossProfit))],
      ["Gross Margin", encodeHtml(formatPercent(payload.grossMarginPct))],
      ["Average Daily Sales", encodeHtml(formatMoney(payload.averageDailySales))],
    ];

    const paymentRows = payload.paymentBreakdown.map((row) => [
      encodeHtml(row.method),
      encodeHtml(formatMoney(row.amount)),
      encodeHtml(formatPercent(row.sharePct)),
    ]);

    const categoryRows = payload.categories.map((row) => [
      encodeHtml(row.category),
      encodeHtml(row.quantity),
      encodeHtml(formatMoney(row.revenue)),
      encodeHtml(formatMoney(row.cogs)),
      encodeHtml(formatMoney(row.grossProfit)),
      encodeHtml(formatPercent(row.revenueSharePct)),
    ]);

    const productRows = payload.topProducts.map((row) => [
      encodeHtml(row.product),
      encodeHtml(row.quantity),
      encodeHtml(formatMoney(row.revenue)),
      encodeHtml(formatMoney(row.cogs)),
      encodeHtml(formatMoney(row.grossProfit)),
      encodeHtml(formatPercent(row.grossMarginPct)),
    ]);

    const comparisonRows = payload.comparisonProducts.map((row) => [
      encodeHtml(row.product),
      encodeHtml(row.period1Qty),
      encodeHtml(row.period2Qty),
      encodeHtml(formatPercent(row.qtyChangePct)),
      encodeHtml(formatMoney(row.period1Revenue)),
      encodeHtml(formatMoney(row.period2Revenue)),
      encodeHtml(formatMoney(row.revenueChange)),
      encodeHtml(formatPercent(row.revenueChangePct)),
    ]);

    const dailyTrendRows = payload.dailyTrend.map((row) => [
      encodeHtml(formatDateLabel(row.label)),
      encodeHtml(formatMoney(row.revenue)),
    ]);

    const ledgerRows = payload.transactions.map((row) => [
      encodeHtml(row.reference),
      encodeHtml(row.dateTime),
      encodeHtml(row.paymentMethod),
      encodeHtml(row.items),
      encodeHtml(formatMoney(row.netTotal)),
    ]);

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${encodeHtml(payload.title)}</title>
  <style>
    @page { size: A4 portrait; margin: 14mm; }
    body {
      font-family: "Segoe UI", Arial, sans-serif;
      color: #1d1d1d;
      margin: 0;
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }
    .header { border-bottom: 3px solid #b88447; padding-bottom: 10px; margin-bottom: 14px; }
    .title { margin: 0; font-size: 24px; color: #222; }
    .subtitle { margin: 2px 0 0 0; font-size: 13px; color: #555; }
    .meta { margin-top: 10px; font-size: 12px; color: #444; line-height: 1.5; }
    .section { margin-top: 18px; page-break-inside: avoid; }
    .section h2 { margin: 0 0 8px 0; font-size: 14px; color: #2a2a2a; text-transform: uppercase; letter-spacing: 0.4px; }
    .report-table { width: 100%; border-collapse: collapse; font-size: 11px; }
    .report-table th { background: #151515; color: #fff; padding: 6px 7px; text-align: left; }
    .report-table td { border-bottom: 1px solid #e1e1e1; padding: 6px 7px; }
    .report-table tbody tr:nth-child(even) td { background: #f7f7f7; }
    .kpi-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; margin-top: 8px; }
    .kpi { border: 1px solid #d8d8d8; border-radius: 7px; padding: 7px; background: #fafafa; }
    .kpi .k { font-size: 10px; color: #666; text-transform: uppercase; }
    .kpi .v { margin-top: 4px; font-size: 13px; font-weight: 700; color: #1f1f1f; }
    .footer-note { margin-top: 20px; font-size: 10px; color: #666; }
    @media print {
      .print-hint { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1 class="title">${encodeHtml(payload.title)}</h1>
    <p class="subtitle">${encodeHtml(payload.subtitle)}</p>
    <div class="meta">
      <div><strong>Period:</strong> ${encodeHtml(payload.periodLabel)}</div>
      <div><strong>Comparison:</strong> ${encodeHtml(payload.comparisonLabel)}</div>
      <div><strong>Generated:</strong> ${encodeHtml(payload.generatedAt)}</div>
    </div>
  </div>

  <div class="print-hint" style="margin-bottom:8px;font-size:11px;color:#555;">
    Use your browser print dialog and choose "Save as PDF". Also check [x] Background graphics for full highlights.
  </div>

  <section class="section">
    <h2>Executive Summary</h2>
    ${toPdfHtmlTable(["Metric", "Value"], summaryRows)}
    <div class="kpi-grid">
      <div class="kpi"><div class="k">Net Revenue</div><div class="v">${encodeHtml(
        formatMoney(payload.netRevenue)
      )}</div></div>
      <div class="kpi"><div class="k">Gross Profit</div><div class="v">${encodeHtml(
        formatMoney(payload.grossProfit)
      )}</div></div>
      <div class="kpi"><div class="k">Gross Margin</div><div class="v">${encodeHtml(
        formatPercent(payload.grossMarginPct)
      )}</div></div>
      <div class="kpi"><div class="k">Transactions</div><div class="v">${encodeHtml(
        payload.totalTransactions
      )}</div></div>
      <div class="kpi"><div class="k">COGS (Cost of Goods Sold)</div><div class="v">${encodeHtml(
        formatMoney(payload.cogs)
      )}</div></div>
    </div>
  </section>

  <section class="section">
    <h2>Payment Mix</h2>
    ${toPdfHtmlTable(["Method", "Amount", "Share"], paymentRows)}
  </section>

  <section class="section">
    <h2>Revenue by Category</h2>
    ${toPdfHtmlTable(["Category", "Qty", "Revenue", "COGS (Cost of Goods Sold)", "Gross Profit", "Share"], categoryRows)}
  </section>

  <section class="section">
    <h2>Top Product Profitability</h2>
    ${toPdfHtmlTable(["Product", "Qty", "Revenue", "COGS (Cost of Goods Sold)", "Gross Profit", "Margin"], productRows)}
  </section>

  <section class="section">
    <h2>Comparative Product Analysis</h2>
    ${toPdfHtmlTable(
      ["Product", "Current Qty", "Previous Qty", "Qty Delta %", "Current Revenue", "Previous Revenue", "Revenue Delta", "Revenue Delta %"],
      comparisonRows
    )}
  </section>

  <section class="section">
    <h2>Daily Revenue Trend</h2>
    ${toPdfHtmlTable(["Date", "Revenue"], dailyTrendRows)}
  </section>

  <section class="section">
    <h2>Transaction Ledger</h2>
    ${toPdfHtmlTable(["Reference", "Date Time", "Payment", "Items", "Net Total"], ledgerRows)}
  </section>

  <p class="footer-note">This report is generated from backend reportable sales only (void/refunded excluded, net totals applied).</p>
</body>
</html>
    `;

    reportWindow.document.open();
    reportWindow.document.write(html);
    reportWindow.document.close();
    reportWindow.focus();
    reportWindow.print();
  };

  const formatDateTime = (value?: string) => {
    if (!value) {
      return "-";
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? "-" : parsed.toLocaleString();
  };

  const actionRequestStatusSummary = returnsRequests.reduce(
    (acc, request) => {
      acc.total += 1;
      acc[request.status] += 1;
      return acc;
    },
    {
      total: 0,
      requested: 0,
      approved: 0,
      rejected: 0,
      completed: 0,
    }
  );

  const exceptionSales = [...salesForReturns]
    .filter((sale) => {
      const status = String(sale.status || "").toLowerCase();
      return status === "void" || status === "refunded";
    })
    .sort(
      (a, b) =>
        new Date(b.created_at || 0).getTime() -
        new Date(a.created_at || 0).getTime()
    )
    .slice(0, 15);

  const pendingActionRequests = [...returnsRequests]
    .filter((request) => request.status === "requested")
    .sort(
      (a, b) =>
        new Date(b.created_at || 0).getTime() -
        new Date(a.created_at || 0).getTime()
    )
    .slice(0, 15);

  const syncStatusSummaryFallback = syncQueueItems.reduce(
    (acc, queueItem) => {
      const status = queueItem.status;
      if (Object.prototype.hasOwnProperty.call(acc, status)) {
        acc[status] += 1;
      }
      return acc;
    },
    {
      queued: 0,
      processing: 0,
      failed: 0,
      conflict: 0,
      synced: 0,
      cancelled: 0,
    }
  );

  const effectiveSyncSummary = syncSummary || syncStatusSummaryFallback;

  const selectedReceiptItems = selectedReceiptSale
    ? getSaleLineItems(selectedReceiptSale)
    : [];

  const escapeReceiptHtml = (text: string) =>
    text
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");

  const buildReceiptMarkup = (sale: Sale) => {
    const receiptItems = getSaleLineItems(sale);
    const itemRows = receiptItems
      .map((item) => {
        const quantity = Number(item.quantity || 0);
        const unitPrice = Number(item.unit_price || 0);
        const lineTotal =
          Number(item.line_total || 0) || Number(quantity * unitPrice);
        return `<tr><td>${escapeReceiptHtml(item.name || `Item-${item.product_id}`)}</td><td>${quantity}</td><td>PHP ${unitPrice.toFixed(2)}</td><td>PHP ${lineTotal.toFixed(2)}</td></tr>`;
      })
      .join("");

    const simpleReference = getReceiptReferenceDisplay(sale);
    const originalReference = sale.public_reference || "";

    return `<!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Receipt ${escapeReceiptHtml(simpleReference)}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; color: #111; }
            h1, h2, h3, p { margin: 0; }
            .header { text-align: center; margin-bottom: 16px; }
            .meta { margin: 12px 0; line-height: 1.5; font-size: 13px; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 13px; }
            th, td { border-bottom: 1px solid #ddd; padding: 8px 4px; text-align: left; }
            .totals { margin-top: 14px; font-size: 14px; }
            .totals p { display: flex; justify-content: space-between; margin-top: 6px; }
            .grand { font-weight: 700; font-size: 16px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>La Tia Fanny POS</h2>
            <p>Official Receipt</p>
          </div>
          <div class="meta">
            <p><strong>Reference:</strong> ${escapeReceiptHtml(simpleReference)}</p>
            ${originalReference ? `<p><strong>System Ref:</strong> ${escapeReceiptHtml(originalReference)}</p>` : ""}
            <p><strong>Date:</strong> ${escapeReceiptHtml(
              formatDateTime(sale.created_at)
            )}</p>
            <p><strong>Status:</strong> ${escapeReceiptHtml(
              String(sale.status || "paid")
            )}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Qty</th>
                <th>Unit</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemRows || '<tr><td colspan="4">No line items available</td></tr>'}
            </tbody>
          </table>
          <div class="totals">
            <p><span>Subtotal</span><span>PHP ${Number(sale.subtotal || 0).toFixed(2)}</span></p>
            <p><span>Discount</span><span>PHP ${Number(sale.discount || 0).toFixed(2)}</span></p>
            <p><span>Tax</span><span>PHP ${Number(sale.tax || 0).toFixed(2)}</span></p>
            <p class="grand"><span>Total Order</span><span>PHP ${Number(sale.total || 0).toFixed(2)}</span></p>
          </div>
        </body>
      </html>`;
  };

  const openReceiptDetails = async (saleId: number) => {
    setIsLoadingReceipts(true);
    try {
      const receiptSale = await saleService.getById(saleId);
      setSelectedReceiptSale(receiptSale);
    } catch (error: any) {
      console.error("Failed to load receipt details:", error);
      alert(error.response?.data?.message || "Failed to load receipt details.");
    } finally {
      setIsLoadingReceipts(false);
    }
  };

  const searchReceipts = async () => {
    setIsLoadingReceipts(true);
    try {
      const reference = receiptFilters.reference.trim();
      let matches: Sale[] = [];

      if (reference) {
        const numericLookup = reference.replace(/^#/, "").trim();
        if (/^\d+$/.test(numericLookup)) {
          const matchedById = salesForReturns.find(
            (sale) =>
              String(sale.id) === numericLookup ||
              String(sale.id).padStart(5, "0") === numericLookup
          );

          if (matchedById) {
            const hydratedById = await saleService.getById(matchedById.id);
            matches = hydratedById ? [hydratedById] : [matchedById];
          }
        }

        if (matches.length === 0) {
          try {
            const matchedSale = await saleService.getByReference(reference);
            matches = matchedSale ? [matchedSale] : [];
          } catch (lookupError) {
            // Fallback allows search even when dedicated reference endpoint is not yet deployed.
            matches = salesForReturns.filter((sale) =>
              sale.public_reference.toLowerCase().includes(reference.toLowerCase())
            );

            if (matches.length === 0) {
              throw lookupError;
            }
          }
        }
      } else if (receiptFilters.startDate || receiptFilters.endDate) {
        const startDate = receiptFilters.startDate || receiptFilters.endDate;
        const endDate = receiptFilters.endDate || receiptFilters.startDate;
        matches = await saleService.getSalesByDateRange(startDate, endDate);
      } else {
        matches = salesForReturns;
      }

      const sortedMatches = [...matches].sort(
        (a, b) =>
          new Date(b.created_at || 0).getTime() -
          new Date(a.created_at || 0).getTime()
      );

      setReceiptSearchResults(sortedMatches);
      if (sortedMatches.length === 0) {
        setSelectedReceiptSale(null);
      }
    } catch (error: any) {
      console.error("Failed to search receipts:", error);
      setReceiptSearchResults([]);
      setSelectedReceiptSale(null);
      alert(error.response?.data?.message || "Failed to search receipts.");
    } finally {
      setIsLoadingReceipts(false);
    }
  };

  const resetReceiptFilters = () => {
    setReceiptFilters({
      reference: "",
      startDate: "",
      endDate: "",
    });
    setOpenReceiptDatePicker(null);
    setReceiptSearchResults(
      [...salesForReturns].sort(
        (a, b) =>
          new Date(b.created_at || 0).getTime() -
          new Date(a.created_at || 0).getTime()
      )
    );
    setSelectedReceiptSale(null);
  };

  const reprintReceipt = async (saleId: number) => {
    setIsLoadingReceipts(true);
    try {
      const receiptSale = await saleService.getById(saleId);
      const popup = window.open("", "_blank", "width=420,height=760");

      if (!popup) {
        alert("Popup was blocked. Please allow popups to print receipts.");
        return;
      }

      popup.document.write(buildReceiptMarkup(receiptSale));
      popup.document.close();
      popup.focus();
      popup.print();
    } catch (error: any) {
      console.error("Failed to reprint receipt:", error);
      alert(error.response?.data?.message || "Failed to reprint receipt.");
    } finally {
      setIsLoadingReceipts(false);
    }
  };

  const selectedSaleForRequest = salesForReturns.find(
    (sale) =>
      sale.public_reference.toLowerCase() ===
      newActionRequest.saleReference.trim().toLowerCase()
  );

  const filteredActionRequests = returnsRequests.filter((request) => {
    if (returnsStatusFilter !== "all" && request.status !== returnsStatusFilter) {
      return false;
    }

    const reference = request.sale?.public_reference || getSaleReferenceById(request.sale_id);
    const search = returnsSearch.trim().toLowerCase();

    if (!search) {
      return true;
    }

    return (
      reference.toLowerCase().includes(search) ||
      request.reason.toLowerCase().includes(search) ||
      request.status.toLowerCase().includes(search) ||
      request.action_type.toLowerCase().includes(search)
    );
  });

  return (
    <div className="admin-container">
      <nav className="admin-nav">
        <div>
          <div className="nav-header">
            <h2>La Tia Fanny POS</h2>
          </div>
          <div className="nav-items">
            {navItems.map((item) => (
              <button
                key={item.id}
                className={`nav-btn ${currentPage === item.id ? "active" : ""}`}
                onClick={() => setCurrentPage(item.id)}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div className="nav-footer">
          <button
            className={`nav-btn ${currentPage === "settings" ? "active" : ""}`}
            onClick={() => setCurrentPage("settings")}
          >
            Settings
          </button>
          <button className="logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </nav>

      <div className="admin-content">
        <h1>
          {currentPage === "dashboard" && "Welcome to Dashboard"}
          {currentPage === "items" && "Items Management"}
          {currentPage === "inventory" && "Inventory Management"}
          {currentPage === "reports" && "Reports"}
          {currentPage === "receipts" && "Receipt Lookup And Reprint"}
          {currentPage === "returns" && "Returns And Refunds"}
          {currentPage === "sync" && "Offline Sync Monitor"}
          {currentPage === "settings" && "Settings"}
        </h1>
        <p>Point of Sale System - Admin Panel</p>
        
        {currentPage === "dashboard" && (
          <div className="dashboard-cards">
            <div className="card">
              <h3>Orders</h3>
              <p className="card-value">{getDailyTotalTransactions()}</p>
            </div>
            <div className="card">
              <h3>Revenue</h3>
              <p className="card-value">PHP {getDailyTotalRevenue().toFixed(2)}</p>
            </div>
            <div className="card">
              <h3>Customers</h3>
              <p className="card-value">{uniqueCustomersCount}</p>
            </div>
            <div className="card">
              <h3>Products</h3>
              <p className="card-value">{displayedItemsCount}</p>
            </div>
          </div>
        )}

        {currentPage === "inventory" && (
          <div className="inventory-page">
            <div className="inventory-tabs">
              <button
                className={`inv-tab-btn ${inventoryView === "inventory" ? "active" : ""}`}
                onClick={() => setInventoryView("inventory")}
              >
                INVENTORY
              </button>
              <button
                className={`inv-tab-btn ${inventoryView === "ingredients" ? "active" : ""}`}
                onClick={() => setInventoryView("ingredients")}
              >
                LINK INGREDIENTS
              </button>
            </div>

            {inventoryView === "inventory" && (
              <div className="inventory-content">
                <p className="inventory-ledger-note">
                  Beginning + Added - Deducted should reconcile to Current. Use Start Inputted + to record opening stock adjustments.
                </p>
                <div className="create-ingredient-section">
                  <h3>Create Ingredient</h3>
                  <div className="ingredient-form">
                    <input
                      type="text"
                      placeholder="Ingredient Name"
                      value={newInventoryItem.name}
                      onChange={(e) =>
                        setNewInventoryItem({ ...newInventoryItem, name: e.target.value })
                      }
                    />
                    <input
                      type="number"
                      placeholder="Amount in Stock"
                      step="0.01"
                      value={newInventoryItem.quantity}
                      onChange={(e) =>
                        setNewInventoryItem({ ...newInventoryItem, quantity: e.target.value })
                      }
                    />
                    <input
                      type="text"
                      placeholder="Measure e.g. grams"
                      value={newInventoryItem.unit}
                      onChange={(e) =>
                        setNewInventoryItem({ ...newInventoryItem, unit: e.target.value })
                      }
                    />
                    <button
                      onClick={addInventoryItem}
                      className="add-ingredient-btn"
                      disabled={isSavingInventory || isInventoryDuplicate}
                      title={isInventoryDuplicate ? "This ingredient already exists" : "Add new ingredient to inventory"}
                    >
                      {isSavingInventory ? "ADDING..." : "ADD INGREDIENT"}
                    </button>
                    {isInventoryDuplicate && (
                      <div className="duplicate-warning">
                        This ingredient already exists in inventory
                      </div>
                    )}
                  </div>
                </div>

                <div className="inventory-table">
                  <div className="table-header">
                    <div className="col-ingredient">Ingredient</div>
                    <div className="col-beginning">Beginning Today</div>
                    <div className="col-added">Added</div>
                    <div className="col-deducted">Deducted</div>
                    <div className="col-current">Current</div>
                    <div className="col-start">Start Inputted</div>
                    <div className="col-actions"></div>
                  </div>
                  <div className="table-body">
                    {inventory.map((item) => {
                      const summary = inventoryDailySummaryMap[item.id];
                      const openingValue = inventoryOpeningInputs[item.id] ?? "";
                      const isExpanded = expandedInventoryHistoryIds.includes(item.id);
                      const isLoadingHistory = loadingInventoryHistoryIds.includes(item.id);
                      const historyRows = inventoryHistoryByItemId[item.id] || [];

                      return (
                        <div key={item.id} className="inventory-row-wrapper">
                          <div className="table-row">
                            <div className="col-ingredient">
                              <span
                                className="delete-icon"
                                style={{ cursor: "pointer" }}
                                onClick={() => deleteInventoryItem(item.id)}
                                title="Delete ingredient"
                              >
                                Delete
                              </span>
                              <span className="item-name">{item.name}</span>
                            </div>
                            <div className="col-beginning"><span>{Number(summary?.beginning_today ?? item.quantity).toFixed(3)}</span></div>
                            <div className="col-added"><span>{Number(summary?.added_today ?? 0).toFixed(3)}</span></div>
                            <div className="col-deducted"><span>{Number(summary?.deducted_today ?? 0).toFixed(3)}</span></div>
                            <div className="col-current"><span>{Number(summary?.current_quantity ?? item.quantity).toFixed(3)}</span></div>
                            <div className="col-start">
                              <input
                                type="number"
                                step="0.001"
                                min="0"
                                value={openingValue}
                                onChange={(e) =>
                                  setInventoryOpeningInputs((prev) => ({
                                    ...prev,
                                    [item.id]: e.target.value,
                                  }))
                                }
                              />
                            </div>
                            <div className="col-actions">
                              <div className="inventory-action-buttons">
                                <button
                                  className="add-action-btn"
                                  onClick={() => applyOpeningInput(item)}
                                  disabled={isApplyingOpeningItemId === item.id}
                                  title="Apply opening stock adjustment"
                                >
                                  {isApplyingOpeningItemId === item.id ? "..." : "+"}
                                </button>
                                <button
                                  className={`history-action-btn ${isExpanded ? "active" : ""}`}
                                  onClick={() => toggleInventoryHistory(item.id)}
                                  title="Toggle movement history"
                                >
                                  H
                                </button>
                              </div>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="inventory-history-row">
                              <div className="inventory-history-panel">
                                <h4>{item.name} Movement History</h4>
                                {isLoadingHistory ? (
                                  <p className="history-empty">Loading history...</p>
                                ) : historyRows.length === 0 ? (
                                  <p className="history-empty">No movement history yet.</p>
                                ) : (
                                  <table className="inventory-history-table">
                                    <thead>
                                      <tr>
                                        <th>Date</th>
                                        <th>Type</th>
                                        <th>Quantity</th>
                                        <th>Notes</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {historyRows.map((movement) => {
                                        const qty = Number(movement.quantity || 0);
                                        const qtyClass = qty >= 0 ? "movement-positive" : "movement-negative";

                                        return (
                                          <tr key={movement.id}>
                                            <td>{formatDateTime(movement.created_at)}</td>
                                            <td className="capitalize">{movement.movement_type}</td>
                                            <td className={qtyClass}>{qty >= 0 ? `+${qty.toFixed(3)}` : qty.toFixed(3)}</td>
                                            <td>{movement.notes || "-"}</td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {inventoryView === "ingredients" && (
              <div className="link-ingredients-view">
                <div className="ingredients-grid">
                  {categories.map((category) => (
                    <div key={category.id} className="ingredients-category-section">
                      <div className="ingredients-category-header">
                        <h3>{category.name}</h3>
                      </div>
                      <div className="ingredients-items-list">
                        {items
                          .filter((item) => item.category === category.name)
                          .map((item) => (
                            <div key={item.id} className="ingredient-item-row">
                              <div className="ingredient-item-info">
                                <div className="ingredient-item-name">{item.name}</div>
                                <div className="ingredient-item-price">PHP {parseFloat(String(item.price)).toFixed(2)}</div>
                              </div>
                              <div className="ingredient-inventory-selector">
                                {editingIngredientItemId === item.id ? (
                                  <div className="edit-mode-container">
                                    <div className="inventory-selections">
                                      {tempIngredients.map((ing, idx) => {
                                        return (
                                          <div key={idx} className="inventory-selection">
                                            <input
                                              type="text"
                                              list={`inventory-list-${item.id}`}
                                              value={inventory.find((inv) => inv.id === ing.inventoryItemId)?.name || ""}
                                              onChange={(e) => {
                                                const typedValue = e.target.value;
                                                const invItem = inventory.find((inv) => inv.name === typedValue);
                                                const newIngs = [...tempIngredients];
                                                newIngs[idx].inventoryItemId = invItem?.id || 0;
                                                setTempIngredients(newIngs);
                                              }}
                                              placeholder="Search or type ingredient..."
                                              className="inventory-select"
                                              autoComplete="off"
                                            />
                                            <datalist id={`inventory-list-${item.id}`}>
                                              {inventory.map((inv) => (
                                                <option key={inv.id} value={inv.name} />
                                              ))}
                                            </datalist>
                                            <input
                                              type="number"
                                              min="0"
                                              step="0.01"
                                              value={ing.quantity === 0 ? "" : ing.quantity}
                                              onChange={(e) => {
                                                const newIngs = [...tempIngredients];
                                                newIngs[idx].quantity = parseFloat(e.target.value) || 0;
                                                setTempIngredients(newIngs);
                                              }}
                                              placeholder="0"
                                              className="quantity-input"
                                            />
                                            <button
                                              onClick={() => {
                                                const newIngs = tempIngredients.filter((_, i) => i !== idx);
                                                setTempIngredients(newIngs);
                                              }}
                                              className="remove-ingredient-btn"
                                              title="Remove ingredient"
                                            >
                                              x
                                            </button>
                                          </div>
                                        );
                                      })}
                                    </div>
                                    <div className="ingredient-actions">
                                      <button
                                        onClick={() => {
                                          const newIngs = [...tempIngredients, { inventoryItemId: 0, quantity: 0 }];
                                          setTempIngredients(newIngs);
                                        }}
                                        className="add-ingredient-btn"
                                        title="Add ingredient"
                                      >
                                        +
                                      </button>
                                      <button
                                        onClick={saveItemIngredients}
                                        className="save-ingredients-btn"
                                      >
                                        SAVE
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="view-mode-container">
                                    <div className="inventory-selections">
                                      {(itemIngredients[item.id] || []).map((ing, idx) => {
                                        const invItem = inventory.find((inv) => inv.id === ing.inventoryItemId);
                                        return (
                                          <div key={idx} className="inventory-selection-display">
                                            <span className="ingredient-name">{invItem?.name || "N/A"}</span>
                                            <span className="ingredient-qty">{ing.quantity} {invItem?.unit}</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                    <button
                                      onClick={() => startEditingIngredients(item.id)}
                                      className="edit-ingredients-btn"
                                      title="Edit ingredients"
                                    >
                                      Edit
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {inventoryView === "ingredients" && (
              <div className="inventory-content">
              </div>
            )}
          </div>
        )}

        {currentPage === "items" && (
          <div className="items-page">
            <div className="items-view-content">
              <div className="category-form">
                <input
                  type="text"
                  placeholder="Category Name"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && addCategory()}
                />
                <button
                  onClick={addCategory}
                  className="add-category-btn"
                  disabled={isCategoryDuplicate || isAddingCategory}
                >
                  {isAddingCategory ? "ADDING..." : "ADD CATEGORY"}
                </button>
                {isCategoryDuplicate && (
                  <div className="input-error">Category already exists</div>
                )}
              </div>

              <div className="categories-grid">
                {categories.map((category) => (
                  <div key={category.id} className="category-section">
                    <div className="category-header">
                      <h3>{category.name}</h3>
                      <div className="header-right">
                        <div className="header-columns">
                          <span>Cost</span>
                          <span>Price</span>
                        </div>
                        <div className="category-actions">
                          <button
                            onClick={() =>
                              setEditConfirmData({
                                id: category.id,
                                oldName: category.name,
                                newName: category.name,
                              })
                            }
                            className="category-edit-btn"
                            title="Edit category"
                          >
                            <svg className="icon-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                              <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z" fill="#fff"/>
                              <path d="M20.71 7.04a1.003 1.003 0 0 0 0-1.42l-2.34-2.34a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z" fill="#fff"/>
                            </svg>
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(category.id)}
                            className="category-delete-action-btn"
                            title="Delete category"
                          >
                            <svg className="icon-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                              <path d="M9 3v1H4v2h16V4h-5V3H9z" fill="#fff"/>
                              <path d="M6 7v13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6zm3 3h2v8H9V10zm4 0h2v8h-2V10z" fill="#fff"/>
                            </svg>
                          </button>
                          <button
                            onClick={() =>
                              setEditingCategoryId(
                                editingCategoryId === category.id ? null : category.id
                              )
                            }
                            className="category-add-item-btn"
                            title="Add item"
                            aria-label={`Add item to ${category.name}`}
                          >
                            <span className="add-plus-icon" aria-hidden="true">+</span>
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="items-in-category">
                      {editingCategoryId === category.id && (
                        <div className="inline-item-form">
                          <div className="form-header">
                            <h4>Add New Item to {category.name}</h4>
                          </div>
                          <div className="form-row">
                            <input
                              type="text"
                              placeholder="Item name"
                              value={inlineItemForm.name}
                              onChange={(e) =>
                                setInlineItemForm({ ...inlineItemForm, name: e.target.value })
                              }
                              className="form-input full-width"
                            />
                          </div>
                          <div className="form-row">
                            <div className="form-group">
                              <input
                                type="number"
                                placeholder="Cost"
                                step="0.01"
                                value={inlineItemForm.cost}
                                onChange={(e) =>
                                  setInlineItemForm({ ...inlineItemForm, cost: e.target.value })
                                }
                                className="form-input"
                              />
                            </div>
                            <div className="form-group">
                              <input
                                type="number"
                                placeholder="Price"
                                step="0.01"
                                value={inlineItemForm.price}
                                onChange={(e) =>
                                  setInlineItemForm({ ...inlineItemForm, price: e.target.value })
                                }
                                className="form-input"
                              />
                            </div>
                            <button
                              onClick={() => saveInlineItem(category.name)}
                              className="save-items-btn"
                              disabled={isSavingItem}
                            >
                              {isSavingItem ? 'SAVING...' : 'SAVE ITEMS'}
                            </button>
                          </div>
                        </div>
                      )}
                      {items
                        .filter((item) => item.category === category.name)
                        .map((item) => (
                          <div key={item.id} className="category-item-row">
                            <div
                              className={`item-pic-placeholder ${getItemImageUrl(item) ? "has-image" : ""} ${dragOverImageItemId === item.id ? "drag-over" : ""} ${isUploadingImageItemId === item.id ? "is-uploading" : ""}`}
                              role="button"
                              tabIndex={isUploadingImageItemId === item.id ? -1 : 0}
                              aria-disabled={isUploadingImageItemId === item.id}
                              onDragOver={(event) => {
                                event.preventDefault();
                                setDragOverImageItemId(item.id);
                              }}
                              onDragLeave={() => {
                                if (dragOverImageItemId === item.id) {
                                  setDragOverImageItemId(null);
                                }
                              }}
                              onDrop={(event) => {
                                event.preventDefault();
                                const droppedFile = event.dataTransfer.files?.[0];
                                if (droppedFile) {
                                  void uploadItemImage(item, droppedFile);
                                }
                              }}
                              onClick={() => {
                                if (isUploadingImageItemId !== item.id) {
                                  openItemImagePicker(item.id);
                                }
                              }}
                              onKeyDown={(event) => {
                                if (isUploadingImageItemId === item.id) {
                                  return;
                                }
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  openItemImagePicker(item.id);
                                }
                              }}
                              title="Click or drop an image"
                            >
                              {getItemImageUrl(item) ? (
                                <img
                                  src={getItemImageUrl(item)}
                                  alt={`${item.name} preview`}
                                  className="item-image-preview"
                                  loading="lazy"
                                />
                              ) : (
                                <span className="item-image-placeholder-text">Drop Picture Here</span>
                              )}
                              {isUploadingImageItemId === item.id && (
                                <span className="item-image-uploading">Uploading...</span>
                              )}
                              <input
                                id={getItemImageInputId(item.id)}
                                type="file"
                                accept="image/*"
                                className="item-image-input"
                                onChange={(event) => {
                                  const selectedFile = event.target.files?.[0];
                                  if (selectedFile) {
                                    void uploadItemImage(item, selectedFile);
                                  }
                                  event.currentTarget.value = "";
                                }}
                              />
                            </div>
                            <div className="item-name">{item.name}</div>
                            <input
                              type="number"
                              className="item-cost-input"
                              value={item.cost}
                              readOnly
                            />
                            <input
                              type="number"
                              className="item-price-input"
                              value={item.price}
                              readOnly
                            />
                            <button
                                onClick={() => editItemStart(item)}
                                className="item-edit-btn"
                                title={`Edit ${item.name}`}
                                aria-label={`Edit ${item.name}`}
                              >
                                <svg className="icon-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                                  <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z" fill="currentColor"/>
                                  <path d="M20.71 7.04a1.003 1.003 0 0 0 0-1.42l-2.34-2.34a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z" fill="currentColor"/>
                                </svg>
                              </button>
                            <button
                                onClick={() => deleteItem(item.id)}
                                className="item-delete-btn"
                                title={`Delete ${item.name}`}
                                aria-label={`Delete ${item.name}`}
                              >
                                <svg className="icon-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                                  <path d="M9 3v1H4v2h16V4h-5V3H9z" fill="currentColor"/>
                                  <path d="M6 7v13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6zm3 3h2v8H9V10zm4 0h2v8h-2V10z" fill="currentColor"/>
                                </svg>
                              </button>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {currentPage === "reports" && (
          <div className="reports-page">
            <div className="reports-tabs">
              <button
                className={`report-tab-btn ${reportsView === "sales" ? "active" : ""}`}
                onClick={() => setReportsView("sales")}
              >
                Sales Report
              </button>
              <button
                className={`report-tab-btn ${reportsView === "inventory" ? "active" : ""}`}
                onClick={() => setReportsView("inventory")}
              >
                Inventory Report
              </button>
              <button
                className={`report-tab-btn ${reportsView === "exceptions" ? "active" : ""}`}
                onClick={() => setReportsView("exceptions")}
              >
                Exception Report
              </button>
            </div>

            {reportsView === "sales" && (
              <>
                <div className="report-filters">
                  {renderReportDateField("startDate", "Start Date", "report-start-date")}
                  {renderReportDateField("endDate", "End Date", "report-end-date")}
                  <button
                    className="report-filter-apply-btn"
                    onClick={applyReportDateFilter}
                    disabled={isApplyingReportDateFilter}
                  >
                    {isApplyingReportDateFilter ? "Applying..." : "Apply Dates"}
                  </button>
                  <button
                    className="report-filter-reset-btn"
                    onClick={resetReportDateFilter}
                    disabled={isApplyingReportDateFilter}
                  >
                    Reset
                  </button>
                </div>
                <div className="report-filter-presets">
                  <button
                    className="report-filter-preset-btn"
                    onClick={() => applyReportDatePreset("today")}
                    disabled={isApplyingReportDateFilter}
                  >
                    Today
                  </button>
                  <button
                    className="report-filter-preset-btn"
                    onClick={() => applyReportDatePreset("yesterday")}
                    disabled={isApplyingReportDateFilter}
                  >
                    Yesterday
                  </button>
                  <button
                    className="report-filter-preset-btn"
                    onClick={() => applyReportDatePreset("last7days")}
                    disabled={isApplyingReportDateFilter}
                  >
                    Last 7 Days
                  </button>
                  <button
                    className="report-filter-preset-btn"
                    onClick={() => applyReportDatePreset("thisMonth")}
                    disabled={isApplyingReportDateFilter}
                  >
                    This Month
                  </button>
                </div>
              </>
            )}

            {reportsView === "sales" && (
              <div className="report-content">
                <div className="report-actions">
                  <button onClick={() => exportReportToExcel(getUnifiedReportType())} className="export-btn">
                    Export to Excel
                  </button>
                  <button onClick={() => exportReportToPDF(getUnifiedReportType())} className="print-btn">
                    Export to PDF
                  </button>
                </div>
                <div className="report-grid">
                  <div className="report-card">
                    <h3>Total Revenue</h3>
                    <p className="report-value">PHP {getMonthlyTotalRevenue().toFixed(2)}</p>
                  </div>
                  <div className="report-card">
                    <h3>Total Transactions</h3>
                    <p className="report-value">{getMonthlyTotalTransactions()}</p>
                  </div>
                  <div className="report-card">
                    <h3>Average Daily Sales</h3>
                    <p className="report-value">PHP {getAverageDailySales().toFixed(2)}</p>
                  </div>
                  <div className="report-card">
                    <h3>Most Profitable Item</h3>
                    <p className="report-value">
                      {getMostProfitableItem()
                        ? `${getMostProfitableItem()!.name}`
                        : "No data"}
                    </p>
                    <p className="report-subvalue">
                      {getMostProfitableItem()
                        ? `Profit: PHP ${getMostProfitableItem()!.profit.toFixed(2)}`
                        : ""}
                    </p>
                  </div>
                  <div className="report-card">
                    <h3>Best Selling Item</h3>
                    <p className="report-value">
                      {getBestSellingItem()
                        ? `${getBestSellingItem()!.name} (${getBestSellingItem()!.quantity} units)`
                        : "No sales"}
                    </p>
                  </div>
                </div>

                <div className="payment-breakdown">
                  <h2>Payment Breakdown</h2>
                  <div className="breakdown-list">
                    {getPaymentBreakdown().length > 0 ? (
                      getPaymentBreakdown().map((payment, idx) => (
                        <div key={idx} className="breakdown-item">
                          <span className="method-name">{payment.method}</span>
                          <span className="method-amount">PHP {payment.amount.toFixed(2)}</span>
                        </div>
                      ))
                    ) : (
                      <p className="no-data">No transactions for the selected period</p>
                    )}
                  </div>
                </div>

                <div className="sales-per-day">
                  <h2>Sales Per Day</h2>
                  <div className="day-list">
                    {getMonthlyPerformance().filter((d) => d.amount > 0).length > 0 ? (
                      getMonthlyPerformance()
                        .filter((d) => d.amount > 0)
                        .map((day, idx) => (
                          <div key={idx} className="day-item">
                            <span className="day-number">{day.label}</span>
                            <div className="day-bar-container">
                              <div
                                className="day-bar"
                                style={{
                                  width: `${(day.amount / Math.max(...getMonthlyPerformance().map((d) => d.amount))) * 100}%`,
                                }}
                              />
                            </div>
                            <span className="day-amount">PHP {day.amount.toFixed(2)}</span>
                          </div>
                        ))
                    ) : (
                      <p className="no-data">No sales data for the selected period</p>
                    )}
                  </div>
                </div>

                <div className="transactions-table">
                  <h2>Transaction Details</h2>
                  {getSalesReportTransactions().length > 0 ? (
                    <table className="daily-transactions">
                      <thead>
                        <tr>
                          <th>No.</th>
                          <th>Date Time</th>
                          <th>Total (PHP)</th>
                          <th>Payment Method</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getSalesReportTransactions().map((transaction, idx) => (
                          <tr key={transaction.id}>
                            <td>{idx + 1}</td>
                            <td>{new Date(transaction.date).toLocaleString()}</td>
                            <td>PHP {transaction.amount.toFixed(2)}</td>
                            <td className="capitalize">{transaction.paymentMethod}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="no-data">No transactions for the selected period</p>
                  )}
                </div>
              </div>
            )}

            {reportsView === "inventory" && (
              <div className="report-content">
                <div className="inventory-alerts">
                  <div className="alert-section">
                    <h2>Low Stock Items (Less than 10)</h2>
                    <div className="alert-list">
                      {getLowStockItems().length > 0 ? (
                        getLowStockItems().map((item) => (
                          <div key={item.id} className="alert-item low-stock">
                            <span className="alert-icon">Alert</span>
                            <div className="alert-content">
                              <div className="alert-name">{item.name}</div>
                              <div className="alert-quantity">
                                Quantity: {item.quantity} {item.unit}
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="no-data">All items are well stocked</p>
                      )}
                    </div>
                  </div>

                  <div className="alert-section">
                    <h2>Out of Stock Items</h2>
                    <div className="alert-list">
                      {getOutOfStockItems().length > 0 ? (
                        getOutOfStockItems().map((item) => (
                          <div key={item.id} className="alert-item out-of-stock">
                            <span className="alert-icon">Out</span>
                            <div className="alert-content">
                              <div className="alert-name">{item.name}</div>
                              <div className="alert-quantity">
                                Out of stock ({item.unit})
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="no-data">No items out of stock</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {reportsView === "exceptions" && (
              <div className="report-content">
                <div className="report-grid">
                  <div className="report-card">
                    <h3>Pending Requests</h3>
                    <p className="report-value">{actionRequestStatusSummary.requested}</p>
                  </div>
                  <div className="report-card">
                    <h3>Approved Requests</h3>
                    <p className="report-value">{actionRequestStatusSummary.approved}</p>
                  </div>
                  <div className="report-card">
                    <h3>Rejected Requests</h3>
                    <p className="report-value">{actionRequestStatusSummary.rejected}</p>
                  </div>
                  <div className="report-card">
                    <h3>Voided Or Refunded Sales</h3>
                    <p className="report-value">{exceptionSales.length}</p>
                  </div>
                </div>

                <div className="transactions-table">
                  <h2>Pending Approval Requests</h2>
                  {pendingActionRequests.length > 0 ? (
                    <table className="daily-transactions">
                      <thead>
                        <tr>
                          <th>Reference</th>
                          <th>Type</th>
                          <th>Reason</th>
                          <th>Requested</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingActionRequests.map((request) => (
                          <tr key={request.id}>
                            <td>{request.sale?.public_reference || getSaleReferenceById(request.sale_id)}</td>
                            <td className="capitalize">{request.action_type}</td>
                            <td>{request.reason}</td>
                            <td>{formatDateTime(request.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="no-data">No pending approval requests.</p>
                  )}
                </div>

                <div className="transactions-table">
                  <h2>Voided And Refunded Sales</h2>
                  {exceptionSales.length > 0 ? (
                    <table className="daily-transactions">
                      <thead>
                        <tr>
                          <th>Reference</th>
                          <th>Status</th>
                          <th>Total (PHP)</th>
                          <th>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {exceptionSales.map((sale) => (
                          <tr key={sale.id}>
                            <td>{sale.public_reference}</td>
                            <td className="capitalize">{sale.status || "unknown"}</td>
                            <td>PHP {Number(sale.total || 0).toFixed(2)}</td>
                            <td>{formatDateTime(sale.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="no-data">No voided or refunded sales found.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {currentPage === "receipts" && (
          <div className="receipts-page">
            <div className="receipts-search-panel">
              <h2>Search Receipts</h2>
              <div className="receipts-search-controls">
                <input
                  type="text"
                  value={receiptFilters.reference}
                  onChange={(e) =>
                    setReceiptFilters({
                      ...receiptFilters,
                      reference: e.target.value,
                    })
                  }
                  placeholder="Receipt # (e.g. #00023) or system reference"
                />
                {renderReceiptDateField("startDate", "receipts-start-date", "Start Date")}
                {renderReceiptDateField("endDate", "receipts-end-date", "End Date")}
                <button
                  className="receipts-search-btn"
                  onClick={searchReceipts}
                  disabled={isLoadingReceipts}
                >
                  {isLoadingReceipts ? "SEARCHING..." : "SEARCH"}
                </button>
                <button
                  className="receipts-reset-btn"
                  onClick={resetReceiptFilters}
                  disabled={isLoadingReceipts}
                >
                  RESET
                </button>
              </div>
            </div>

            <div className="receipts-layout">
              <section className="receipts-results-panel">
                <h2>Results</h2>
                {receiptSearchResults.length > 0 ? (
                  <div className="receipts-results-list">
                    {receiptSearchResults.map((sale) => (
                      <article key={sale.id} className="receipt-result-card">
                        <div>
                          <div className="receipt-result-reference">{getReceiptReferenceDisplay(sale)}</div>
                          <div className="receipt-result-meta">
                            {sale.public_reference ? `System Ref: ${sale.public_reference}  |  ` : ""}{formatDateTime(sale.created_at)}
                          </div>
                        </div>
                        <div className="receipt-result-side">
                          <div className="receipt-result-total">PHP {Number(sale.total || 0).toFixed(2)}</div>
                          <div className="receipt-result-actions">
                            <button
                              className="receipt-action-btn"
                              onClick={() => openReceiptDetails(sale.id)}
                              disabled={isLoadingReceipts}
                            >
                              VIEW
                            </button>
                            <button
                              className="receipt-action-btn secondary"
                              onClick={() => reprintReceipt(sale.id)}
                              disabled={isLoadingReceipts}
                            >
                              REPRINT
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="no-data">No receipts found for the current filters.</p>
                )}
              </section>

              <section className="receipts-detail-panel">
                <h2>Receipt Detail</h2>
                {selectedReceiptSale ? (
                  <>
                    <div className="receipt-detail-head">
                      <div>
                        <div className="receipt-detail-reference">{getReceiptReferenceDisplay(selectedReceiptSale)}</div>
                        <div className="receipt-detail-meta">
                          {selectedReceiptSale.public_reference ? `System Ref: ${selectedReceiptSale.public_reference}  |  ` : ""}{formatDateTime(selectedReceiptSale.created_at)}
                        </div>
                      </div>
                      <button
                        className="receipt-reprint-detail-btn"
                        onClick={() => reprintReceipt(selectedReceiptSale.id)}
                        disabled={isLoadingReceipts}
                      >
                        REPRINT RECEIPT
                      </button>
                    </div>

                    <table className="receipt-detail-table">
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th>Qty</th>
                          <th>Unit</th>
                          <th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedReceiptItems.length > 0 ? (
                          selectedReceiptItems.map((item) => {
                            const lineTotal = Number(item.line_total || 0) || Number(item.quantity || 0) * Number(item.unit_price || 0);

                            return (
                              <tr key={`${selectedReceiptSale.id}-${item.product_id}-${item.id || 0}`}>
                                <td>{item.name || `Item-${item.product_id}`}</td>
                                <td>{Number(item.quantity || 0)}</td>
                                <td>PHP {Number(item.unit_price || 0).toFixed(2)}</td>
                                <td>PHP {lineTotal.toFixed(2)}</td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={4}>No item breakdown available.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>

                    <div className="receipt-detail-totals">
                      <p>
                        <span>Subtotal</span>
                        <span>PHP {Number(selectedReceiptSale.subtotal || 0).toFixed(2)}</span>
                      </p>
                      <p>
                        <span>Discount</span>
                        <span>PHP {Number(selectedReceiptSale.discount || 0).toFixed(2)}</span>
                      </p>
                      <p>
                        <span>Tax</span>
                        <span>PHP {Number(selectedReceiptSale.tax || 0).toFixed(2)}</span>
                      </p>
                      <p className="grand-total">
                        <span>Total Order</span>
                        <span>PHP {Number(selectedReceiptSale.total || 0).toFixed(2)}</span>
                      </p>
                    </div>
                  </>
                ) : (
                  <p className="no-data">Select a receipt from the result list to view full details.</p>
                )}
              </section>
            </div>
          </div>
        )}

        {currentPage === "returns" && (
          <div className="returns-page">
            <div className="returns-grid">
              <section className="returns-panel">
                <h2>Create Return Or Void Request</h2>
                <p className="returns-subtitle">
                  Enter the official sale reference, choose the request type, and submit it for admin approval.
                </p>

                <div className="returns-form">
                  <label htmlFor="sale-reference-input">Sale Reference</label>
                  <input
                    id="sale-reference-input"
                    list="sale-reference-list"
                    value={newActionRequest.saleReference}
                    onChange={(e) =>
                      setNewActionRequest({
                        ...newActionRequest,
                        saleReference: e.target.value,
                      })
                    }
                    placeholder="Example: SALE-20260423-0001"
                  />
                  <datalist id="sale-reference-list">
                    {salesForReturns.map((sale) => (
                      <option key={sale.id} value={sale.public_reference} />
                    ))}
                  </datalist>

                  <div className="returns-form-row">
                    <div className="returns-form-field">
                      <label htmlFor="request-type">Request Type</label>
                      <select
                        id="request-type"
                        value={newActionRequest.actionType}
                        onChange={(e) =>
                          setNewActionRequest({
                            ...newActionRequest,
                            actionType: e.target.value as SaleActionType,
                          })
                        }
                      >
                        <option value="refund">Refund</option>
                        <option value="void">Void</option>
                      </select>
                    </div>

                    <div className="returns-form-field">
                      <label htmlFor="requested-amount">Requested Amount</label>
                      <input
                        id="requested-amount"
                        type="number"
                        min="0"
                        step="0.01"
                        disabled={newActionRequest.actionType !== "refund"}
                        value={newActionRequest.requestedAmount}
                        onChange={(e) =>
                          setNewActionRequest({
                            ...newActionRequest,
                            requestedAmount: e.target.value,
                          })
                        }
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <label htmlFor="request-reason">Reason</label>
                  <textarea
                    id="request-reason"
                    value={newActionRequest.reason}
                    onChange={(e) =>
                      setNewActionRequest({
                        ...newActionRequest,
                        reason: e.target.value,
                      })
                    }
                    rows={3}
                    placeholder="Explain why this transaction needs a return, refund, or void."
                  />

                  <button
                    className="returns-submit-btn"
                    onClick={submitActionRequest}
                    disabled={isSubmittingReturnRequest}
                  >
                    {isSubmittingReturnRequest ? "SUBMITTING..." : "SUBMIT REQUEST"}
                  </button>
                </div>

                {selectedSaleForRequest && (
                  <div className="return-sale-preview">
                    <h3>Matched Sale</h3>
                    <div className="return-sale-preview-row">
                      <span>Reference</span>
                      <strong>{selectedSaleForRequest.public_reference}</strong>
                    </div>
                    <div className="return-sale-preview-row">
                      <span>Total</span>
                      <strong>PHP {Number(selectedSaleForRequest.total || 0).toFixed(2)}</strong>
                    </div>
                    <div className="return-sale-preview-row">
                      <span>Status</span>
                      <strong className="capitalize">{selectedSaleForRequest.status || "paid"}</strong>
                    </div>
                  </div>
                )}
              </section>

              <section className="returns-panel">
                <div className="returns-queue-header">
                  <h2>Approval Queue</h2>
                  <div className="returns-queue-controls">
                    <select
                      value={returnsStatusFilter}
                      onChange={(e) =>
                        setReturnsStatusFilter(
                          e.target.value as SaleActionRequestStatus | "all"
                        )
                      }
                    >
                      <option value="all">All</option>
                      <option value="requested">Requested</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                      <option value="completed">Completed</option>
                    </select>
                    <input
                      type="text"
                      value={returnsSearch}
                      onChange={(e) => setReturnsSearch(e.target.value)}
                      placeholder="Search reference, reason, or status"
                    />
                  </div>
                </div>

                {isLoadingReturns ? (
                  <p className="no-data">Loading requests...</p>
                ) : filteredActionRequests.length === 0 ? (
                  <p className="no-data">No return or void requests found.</p>
                ) : (
                  <div className="returns-request-list">
                    {filteredActionRequests.map((request) => {
                      const reference =
                        request.sale?.public_reference ||
                        getSaleReferenceById(request.sale_id);

                      return (
                        <article key={request.id} className="returns-request-card">
                          <div className="returns-request-top">
                            <div>
                              <div className="returns-request-reference">{reference}</div>
                              <div className="returns-request-meta">
                                {new Date(request.created_at || "").toLocaleString()}  | 
                                <span className="capitalize"> {request.action_type}</span>
                                {request.requested_amount
                                  ? `  |  PHP ${Number(request.requested_amount).toFixed(2)}`
                                  : ""}
                              </div>
                            </div>
                            <span className={`request-status status-${request.status}`}>
                              {request.status}
                            </span>
                          </div>

                          <p className="returns-request-reason">{request.reason}</p>
                          {request.decision_note && (
                            <p className="returns-request-note">
                              Admin Note: {request.decision_note}
                            </p>
                          )}

                          {request.status === "requested" && (
                            <div className="returns-request-actions">
                              <button
                                className="approve-request-btn"
                                disabled={isReviewingRequestId === request.id}
                                onClick={() =>
                                  reviewActionRequest(request.id, "approved")
                                }
                              >
                                {isReviewingRequestId === request.id
                                  ? "PROCESSING..."
                                  : "APPROVE"}
                              </button>
                              <button
                                className="reject-request-btn"
                                disabled={isReviewingRequestId === request.id}
                                onClick={() =>
                                  reviewActionRequest(request.id, "rejected")
                                }
                              >
                                REJECT
                              </button>
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          </div>
        )}

        {currentPage === "sync" && (
          <div className="sync-page">
            <section className="sync-toolbar-panel">
              <div>
                <h2>Cashier Offline Queue</h2>
                <p className="sync-subtitle">
                  Monitor unsynced cashier transactions, retry failed sync attempts, and resolve conflicts.
                </p>
              </div>
              <div className="sync-toolbar-actions">
                <select
                  value={syncStatusFilter}
                  onChange={(e) =>
                    setSyncStatusFilter(e.target.value as SyncQueueStatus | "all")
                  }
                >
                  <option value="all">All Statuses</option>
                  <option value="queued">Queued</option>
                  <option value="processing">Processing</option>
                  <option value="failed">Failed</option>
                  <option value="conflict">Conflict</option>
                  <option value="synced">Synced</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <button
                  className="sync-refresh-btn"
                  onClick={() => loadSyncMonitor(syncStatusFilter)}
                  disabled={isLoadingSyncQueue}
                >
                  {isLoadingSyncQueue ? "Refreshing..." : "Refresh"}
                </button>
              </div>
            </section>

            {!syncEndpointAvailable && (
              <section className="sync-warning-banner">
                <p>{syncLoadError}</p>
                <p className="sync-contract-note">
                  Expected backend routes: GET /sync/queue, GET /sync/queue/summary, GET /sync/version,
                  POST /sync/queue/:id/retry, POST /sync/queue/:id/cancel, POST /sync/queue/:id/resolve.
                </p>
              </section>
            )}

            <section className="sync-summary-grid">
              <article className="sync-summary-card">
                <span>Queued</span>
                <strong>{effectiveSyncSummary.queued}</strong>
              </article>
              <article className="sync-summary-card">
                <span>Failed</span>
                <strong>{effectiveSyncSummary.failed}</strong>
              </article>
              <article className="sync-summary-card">
                <span>Conflicts</span>
                <strong>{effectiveSyncSummary.conflict}</strong>
              </article>
              <article className="sync-summary-card">
                <span>Synced</span>
                <strong>{effectiveSyncSummary.synced}</strong>
              </article>
            </section>

            <section className="sync-table-panel">
              <div className="sync-table-meta">
                <span>Sync Version: {syncVersion}</span>
                <span>Last Checked: {formatDateTime(syncLastCheckedAt)}</span>
              </div>

              {isLoadingSyncQueue ? (
                <p className="no-data">Loading sync queue...</p>
              ) : syncQueueItems.length === 0 ? (
                <p className="no-data">No queue records found for the selected filter.</p>
              ) : (
                <div className="sync-table-wrapper">
                  <table className="sync-table">
                    <thead>
                      <tr>
                        <th>Queue ID</th>
                        <th>Reference</th>
                        <th>Status</th>
                        <th>Attempts</th>
                        <th>Last Error</th>
                        <th>Updated</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {syncQueueItems.map((queueItem) => {
                        const queueStatus = String(queueItem.status || "queued").toLowerCase();
                        const queueReference =
                          queueItem.transaction_reference || `QUEUE-${queueItem.id}`;
                        const canRetry =
                          queueStatus === "failed" ||
                          queueStatus === "conflict" ||
                          queueStatus === "queued";
                        const canCancel =
                          queueStatus !== "synced" && queueStatus !== "cancelled";
                        const canResolve = queueStatus === "conflict";

                        return (
                          <tr key={queueItem.id}>
                            <td>{queueItem.id}</td>
                            <td>{queueReference}</td>
                            <td>
                              <span className={`sync-status status-${queueStatus}`}>
                                {queueStatus}
                              </span>
                            </td>
                            <td>{Number(queueItem.attempts || 0)}</td>
                            <td>{queueItem.last_error || "-"}</td>
                            <td>
                              {formatDateTime(
                                queueItem.updated_at ||
                                  queueItem.last_attempt_at ||
                                  queueItem.created_at
                              )}
                            </td>
                            <td>
                              <div className="sync-row-actions">
                                {canRetry && (
                                  <button
                                    className="sync-action-btn"
                                    onClick={() => handleSyncQueueAction(queueItem, "retry")}
                                    disabled={isSyncActionItemId === queueItem.id}
                                  >
                                    Retry
                                  </button>
                                )}
                                {canResolve && (
                                  <button
                                    className="sync-action-btn secondary"
                                    onClick={() => handleSyncQueueAction(queueItem, "resolve")}
                                    disabled={isSyncActionItemId === queueItem.id}
                                  >
                                    Resolve
                                  </button>
                                )}
                                {canCancel && (
                                  <button
                                    className="sync-action-btn danger"
                                    onClick={() => handleSyncQueueAction(queueItem, "cancel")}
                                    disabled={isSyncActionItemId === queueItem.id}
                                  >
                                    Cancel
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}

        {currentPage === "settings" && (
          <div className="settings-container">
            <div className="settings-section">
              <div className="payment-methods-header">
                <h2>Payment Methods</h2>
              </div>
              <button 
                onClick={() => setShowPaymentMethods(true)}
                className="select-payment-btn"
              >
                Select Payment Methods
              </button>
            </div>
          </div>
        )}

        {showPaymentMethods && (
          <>
            <div className="modal-backdrop" onClick={() => setShowPaymentMethods(false)}></div>
            <div className="modal-container">
              <div className="payment-methods-modal">
                <div className="modal-header">
                  <div className="modal-header-content">
                    <h2>Payment Methods</h2>
                    <p className="payment-note">Cash is automatically turned on</p>
                  </div>
                  <button
                    className="modal-close"
                    onClick={() => setShowPaymentMethods(false)}
                  >
                    x
                  </button>
                </div>

                <div className="payment-methods-content">
                  <div className="payment-method-item">
                    <label>Bank Transfer</label>
                    <div className="switch-container">
                      <input
                        type="checkbox"
                        checked={paymentMethods.bank_transfer}
                        onChange={() => togglePaymentMethod("bank_transfer")}
                        className="toggle-switch"
                      />
                    </div>
                  </div>
                  <div className="payment-method-item">
                    <label>Card</label>
                    <div className="switch-container">
                      <input
                        type="checkbox"
                        checked={paymentMethods.card}
                        onChange={() => togglePaymentMethod("card")}
                        className="toggle-switch"
                      />
                    </div>
                  </div>
                  <div className="payment-method-item">
                    <label>Credit</label>
                    <div className="switch-container">
                      <input
                        type="checkbox"
                        checked={paymentMethods.credit}
                        onChange={() => togglePaymentMethod("credit")}
                        className="toggle-switch"
                      />
                    </div>
                  </div>
                  <div className="payment-method-item">
                    <label>Food Panda</label>
                    <div className="switch-container">
                      <input
                        type="checkbox"
                        checked={paymentMethods.food_panda}
                        onChange={() => togglePaymentMethod("food_panda")}
                        className="toggle-switch"
                      />
                    </div>
                  </div>
                  <div className="payment-method-item">
                    <label>Gcash</label>
                    <div className="switch-container">
                      <input
                        type="checkbox"
                        checked={paymentMethods.gcash}
                        onChange={() => togglePaymentMethod("gcash")}
                        className="toggle-switch"
                      />
                    </div>
                  </div>
                  <div className="payment-method-item">
                    <label>Grab</label>
                    <div className="switch-container">
                      <input
                        type="checkbox"
                        checked={paymentMethods.grab}
                        onChange={() => togglePaymentMethod("grab")}
                        className="toggle-switch"
                      />
                    </div>
                  </div>
                  <div className="payment-method-item">
                    <label>Maya</label>
                    <div className="switch-container">
                      <input
                        type="checkbox"
                        checked={paymentMethods.maya}
                        onChange={() => togglePaymentMethod("maya")}
                        className="toggle-switch"
                      />
                    </div>
                  </div>
                  <div className="payment-method-item">
                    <label>Default Tax Rate (%)</label>
                    <div className="switch-container">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={defaultTaxRate}
                        onChange={(e) => setDefaultTaxRate(e.target.value)}
                        className="edit-input"
                      />
                    </div>
                  </div>
                  <div className="payment-method-item">
                    <label>Default Discount Rate (%)</label>
                    <div className="switch-container">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={defaultDiscountRate}
                        onChange={(e) => setDefaultDiscountRate(e.target.value)}
                        className="edit-input"
                      />
                    </div>
                  </div>
                  <div className="modal-buttons">
                    <button
                      onClick={() => setShowPaymentMethods(false)}
                      className="cancel-btn"
                      disabled={isSavingPosSettings}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={savePosSettings}
                      className="confirm-btn"
                      disabled={isSavingPosSettings}
                    >
                      {isSavingPosSettings ? "Saving..." : "Save Settings"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
        {/* Delete Confirmation Modal */}
        {deleteConfirmId && (
          <div className="modal-backdrop">
            <div className="modal-container">
              <div className="confirmation-modal">
                <h2>Delete Category?</h2>
                <p className="confirmation-text">
                  Are you sure you want to delete this category? All items in this category will also be removed.
                </p>
                <div className="modal-buttons">
                  <button
                    onClick={() => setDeleteConfirmId(null)}
                    className="cancel-btn"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => confirmDeleteCategory(deleteConfirmId)}
                    className="confirm-delete-btn"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Confirmation Modal */}
        {editConfirmData && (
          <div className="modal-backdrop">
            <div className="modal-container">
              <div className="confirmation-modal">
                <h2>Edit Category Name</h2>
                <p className="confirmation-text">
                  Current name: <strong>{editConfirmData.oldName}</strong>
                </p>
                <input
                  type="text"
                  defaultValue={editConfirmData.newName}
                  onChange={(e) =>
                    setEditConfirmData({ ...editConfirmData, newName: e.target.value })
                  }
                  className="edit-input"
                  placeholder="Enter new category name"
                  autoFocus
                />
                <div className="modal-buttons">
                  <button
                    onClick={() => setEditConfirmData(null)}
                    className="cancel-btn"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => confirmEditCategory(editConfirmData.newName)}
                    className="confirm-btn"
                  >
                    Confirm
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Item Delete Confirmation Modal */}
        {itemDeleteConfirmId && (
          <div className="modal-backdrop">
            <div className="modal-container">
              <div className="confirmation-modal">
                <h2>Delete Item?</h2>
                <p className="confirmation-text">
                  Are you sure you want to delete <strong>{deleteConfirmItemName}</strong>?
                </p>
                <div className="modal-buttons">
                  <button
                    onClick={() => setItemDeleteConfirmId(null)}
                    className="cancel-btn"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => confirmDeleteItem(itemDeleteConfirmId)}
                    className="confirm-delete-btn"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Item Edit Confirmation Modal */}
        {editingItemData && (
          <div className="modal-backdrop">
            <div className="modal-container">
              <div className="confirmation-modal">
                <h2>Edit Item</h2>
                <p className="confirmation-text">Update item details:</p>
                <input
                  type="text"
                  value={editingItemData.name}
                  onChange={(e) =>
                    setEditingItemData({ ...editingItemData, name: e.target.value })
                  }
                  className="edit-input"
                  placeholder="Item name"
                  autoFocus
                />
                <input
                  type="number"
                  value={editingItemData.cost}
                  onChange={(e) =>
                    setEditingItemData({ ...editingItemData, cost: parseFloat(e.target.value) || 0 })
                  }
                  className="edit-input"
                  placeholder="Cost"
                  step="0.01"
                />
                <input
                  type="number"
                  value={editingItemData.price}
                  onChange={(e) =>
                    setEditingItemData({ ...editingItemData, price: parseFloat(e.target.value) || 0 })
                  }
                  className="edit-input"
                  placeholder="Price"
                  step="0.01"
                />
                <div className="modal-buttons">
                  <button
                    onClick={() => setEditingItemData(null)}
                    className="cancel-btn"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => confirmEditItem()}
                    className="confirm-btn"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Admin;




