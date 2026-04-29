import apiClient from "./apiConfig";

export interface PosPaymentMethods {
  cash: boolean;
  bank_transfer: boolean;
  card: boolean;
  credit: boolean;
  food_panda: boolean;
  gcash: boolean;
  grab: boolean;
  maya: boolean;
}

export interface PosSettings {
  payment_methods: PosPaymentMethods;
  default_tax_rate: number;
  default_discount_rate: number;
}

const defaultSettings: PosSettings = {
  payment_methods: {
    cash: true,
    bank_transfer: false,
    card: false,
    credit: false,
    food_panda: false,
    gcash: false,
    grab: false,
    maya: false,
  },
  default_tax_rate: 0,
  default_discount_rate: 0,
};

const normalizeSettings = (input: unknown): PosSettings => {
  const raw = (input as Partial<PosSettings>) || {};
  const methods = (raw.payment_methods as Partial<PosPaymentMethods>) || {};

  return {
    payment_methods: {
      cash: methods.cash ?? true,
      bank_transfer: methods.bank_transfer ?? false,
      card: methods.card ?? false,
      credit: methods.credit ?? false,
      food_panda: methods.food_panda ?? false,
      gcash: methods.gcash ?? false,
      grab: methods.grab ?? false,
      maya: methods.maya ?? false,
    },
    default_tax_rate: Number(raw.default_tax_rate ?? 0),
    default_discount_rate: Number(raw.default_discount_rate ?? 0),
  };
};

const settingsService = {
  getPosSettings: async (): Promise<PosSettings> => {
    const response = await apiClient.get("/settings/pos");
    const data = response.data?.data;
    return normalizeSettings(data || defaultSettings);
  },

  updatePosSettings: async (payload: PosSettings): Promise<PosSettings> => {
    const response = await apiClient.put("/settings/pos", payload);
    const data = response.data?.data;
    return normalizeSettings(data || payload);
  },
};

export default settingsService;
