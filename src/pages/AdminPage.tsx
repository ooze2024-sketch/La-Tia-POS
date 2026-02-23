import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { productAPI, categoryAPI, inventoryAPI, salesAPI, authAPI, clearAuthToken } from "../services/api";
import "./AdminPage.css";

interface FoodItem {
  id: number;
  name: string;
  category_id: number;
  category?: string;
  cost: number;
  price: number;
  description: string;
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

function Admin() {
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [itemView, setItemView] = useState("item");
  const [inventoryView, setInventoryView] = useState("inventory");
  const [reportsView, setReportsView] = useState("daily");
  const [categories, setCategories] = useState<FoodCategory[]>([]);
  const [items, setItems] = useState<FoodItem[]>([]);
  const [newCategory, setNewCategory] = useState("");
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [newInventoryItem, setNewInventoryItem] = useState({
    name: "",
    quantity: "",
    unit: "",
  });
  const [showPaymentMethods, setShowPaymentMethods] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [inlineItemForm, setInlineItemForm] = useState({
    name: "",
    cost: "",
    price: "",
  });
  // Transaction data will be loaded from API
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [paymentMethods, setPaymentMethods] = useState({
    bank_transfer: false,
    card: false,
    credit: false,
    food_panda: false,
    gcash: false,
    grab: false,
    maya: false,
  });
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [editConfirmData, setEditConfirmData] = useState<{
    id: string;
    oldName: string;
    newName: string;
  } | null>(null);

  // Load data from API on component mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load categories and products from API
      const [categoriesRes, productsRes, inventoryRes, salesRes] = await Promise.all([
        categoryAPI.getAll(),
        productAPI.getAll(),
        inventoryAPI.getAll(),
        salesAPI.getToday(),
      ]);

      if (categoriesRes.success) {
        setCategories(categoriesRes.data);
      }

      if (productsRes.success) {
        // Normalize product shape from API: ensure `category` is the category name (string)
        const normalized = productsRes.data.map((p: any) => ({
          id: p.id,
          name: p.name,
          category_id: p.category_id,
          category: p.category?.name ?? (typeof p.category === 'string' ? p.category : ''),
          cost: typeof p.cost === 'string' ? parseFloat(p.cost) : p.cost,
          price: typeof p.price === 'string' ? parseFloat(p.price) : p.price,
          description: p.description ?? '',
        }));

        setItems(normalized);
      }

      if (inventoryRes.success) {
        setInventory(inventoryRes.data);
      }

      if (salesRes.success) {
        // Convert sales data to transaction format
        const txns = salesRes.data.sales?.map((sale: any) => ({
          id: sale.id,
          itemName: sale.saleItems?.[0]?.name || "Sale",
          quantity: sale.saleItems?.reduce((sum: number, item: any) => sum + item.quantity, 0) || 0,
          amount: sale.total,
          paymentMethod: sale.payments?.[0]?.method || "unknown",
          date: new Date(sale.created_at),
          cost: sale.saleItems?.reduce((sum: number, item: any) => sum + item.cost, 0) || 0,
        })) || [];
        setTransactions(txns);
      }
    } catch (error) {
      console.error("Failed to load data:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error("Logout error:", error);
    }
    clearAuthToken();
    navigate("/");
  };

  const togglePaymentMethod = (method: keyof typeof paymentMethods) => {
    setPaymentMethods({ ...paymentMethods, [method]: !paymentMethods[method] });
  };

  const addCategory = async () => {
    if (newCategory.trim()) {
      try {
        const response = await categoryAPI.create({ name: newCategory });
        if (response.success) {
          setCategories([...categories, response.data]);
          setNewCategory("");
        }
      } catch (error) {
        console.error("Failed to add category:", error);
      }
    }
  };

  const confirmDeleteCategory = async (id: string | number) => {
    setDeleteConfirmId(null);
    try {
      await categoryAPI.delete(Number(id));
      setCategories(categories.filter((cat) => cat.id !== id));
      // Also remove items from this category
      setItems(items.filter((item) => item.category_id !== id));
    } catch (error) {
      console.error("Failed to delete category:", error);
    }
  };

  const confirmEditCategory = async (newName: string) => {
    if (editConfirmData && newName.trim()) {
      try {
        await categoryAPI.update(Number(editConfirmData.id), { name: newName });
        // Update the category name
        setCategories(
          categories.map((cat) =>
            cat.id === editConfirmData.id ? { ...cat, name: newName } : cat
          )
        );
        setEditConfirmData(null);
      } catch (error) {
        console.error("Failed to update category:", error);
      }
    }
  };

  const deleteItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const addInventoryItem = () => {
    if (
      newInventoryItem.name.trim() &&
      newInventoryItem.quantity &&
      newInventoryItem.unit.trim()
    ) {
      const item: InventoryItem = {
        id: Date.now().toString(),
        name: newInventoryItem.name,
        quantity: parseFloat(newInventoryItem.quantity),
        unit: newInventoryItem.unit,
      };
      setInventory([...inventory, item]);
      setNewInventoryItem({ name: "", quantity: "", unit: "" });
    }
  };

  const saveInlineItem = async (categoryName: string) => {
    if (inlineItemForm.name.trim() && inlineItemForm.cost && inlineItemForm.price) {
      try {
        // find category id from current categories
        const categoryObj = categories.find((c) => c.name === categoryName);
        if (!categoryObj) {
          console.error('Category not found for', categoryName);
          return;
        }

        const payload = {
          name: inlineItemForm.name,
          category_id: Number(categoryObj.id),
          cost: parseFloat(inlineItemForm.cost),
          price: parseFloat(inlineItemForm.price),
          description: "",
        };

        const res: any = await productAPI.create(payload);
        // API returns created product in res.data
        if (res && res.success) {
          const p = res.data;
          const normalized: FoodItem = {
            id: p.id,
            name: p.name,
            category_id: p.category_id,
            category: categoryObj.name,
            cost: typeof p.cost === 'string' ? parseFloat(p.cost) : p.cost,
            price: typeof p.price === 'string' ? parseFloat(p.price) : p.price,
            description: p.description ?? '',
          };
          setItems([...items, normalized]);
          setInlineItemForm({ name: "", cost: "", price: "" });
          setEditingCategoryId(null);
        } else {
          console.error('Failed to create product', res);
        }
      } catch (error) {
        console.error('Error saving item:', error);
      }
    }
  };

  const navItems = [
    { id: "dashboard", label: "Dashboard" },
    { id: "items", label: "Items" },
    { id: "inventory", label: "Inventory" },
    { id: "reports", label: "Reports" },
  ];

  // Reports helper functions
  const getDailyTotalRevenue = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return transactions
      .filter((t) => {
        const transDate = new Date(t.date);
        transDate.setHours(0, 0, 0, 0);
        return transDate.getTime() === today.getTime();
      })
      .reduce((sum, t) => sum + t.amount, 0);
  };

  const getDailyTotalTransactions = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return transactions.filter((t) => {
      const transDate = new Date(t.date);
      transDate.setHours(0, 0, 0, 0);
      return transDate.getTime() === today.getTime();
    }).length;
  };

  const getDailyTransactions = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return transactions
      .filter((t) => {
        const transDate = new Date(t.date);
        transDate.setHours(0, 0, 0, 0);
        return transDate.getTime() === today.getTime();
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const getMonthlyTotalTransactions = () => {
    const now = new Date();
    return transactions.filter(
      (t) =>
        new Date(t.date).getMonth() === now.getMonth() &&
        new Date(t.date).getFullYear() === now.getFullYear()
    ).length;
  };

  const getAverageDailySales = () => {
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const monthlyRevenue = getMonthlyTotalRevenue();
    return monthlyRevenue / daysInMonth;
  };

  const getBestSellingItem = () => {
    const itemCounts = transactions.reduce(
      (acc, t) => {
        acc[t.itemName] = (acc[t.itemName] || 0) + t.quantity;
        return acc;
      },
      {} as Record<string, number>
    );
    const bestItem = Object.entries(itemCounts).sort(([, a], [, b]) => b - a)[0];
    return bestItem ? { name: bestItem[0], quantity: bestItem[1] } : null;
  };

  const getPaymentBreakdown = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const breakdown = transactions
      .filter((t) => {
        const transDate = new Date(t.date);
        transDate.setHours(0, 0, 0, 0);
        return transDate.getTime() === today.getTime();
      })
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
    const now = new Date();
    return transactions
      .filter(
        (t) =>
          new Date(t.date).getMonth() === now.getMonth() &&
          new Date(t.date).getFullYear() === now.getFullYear()
      )
      .reduce((sum, t) => sum + t.amount, 0);
  };

  const getMonthlyPerformance = () => {
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
      day: parseInt(day),
      amount,
    }));
  };

  const getMostProfitableItem = () => {
    const itemProfit = items.reduce(
      (acc, item) => {
        const profitPerUnit = item.price - item.cost;
        const unitsSold = transactions
          .filter((t) => t.itemName === item.name)
          .reduce((sum, t) => sum + t.quantity, 0);
        acc[item.name] = profitPerUnit * unitsSold;
        return acc;
      },
      {} as Record<string, number>
    );
    const mostProfitable = Object.entries(itemProfit).sort(([, a], [, b]) => b - a)[0];
    return mostProfitable ? { name: mostProfitable[0], profit: mostProfitable[1] } : null;
  };

  const getLowStockItems = () => {
    return inventory.filter((item) => item.quantity < 10 && item.quantity > 0);
  };

  const getOutOfStockItems = () => {
    return inventory.filter((item) => item.quantity === 0);
  };

  // Export functions
  const exportDailyReportToCSV = () => {
    const today = new Date().toLocaleDateString();
    const totalRevenue = getDailyTotalRevenue();
    const totalTransactions = getDailyTotalTransactions();
    const bestSelling = getBestSellingItem();
    const paymentBreakdown = getPaymentBreakdown();
    const dailyTransactions = getDailyTransactions();

    let csv = "La Tia Fanny POS - Daily Sales Report\n";
    csv += `Date: ${today}\n\n`;
    csv += "SUMMARY\n";
    csv += `Total Revenue (₱),${totalRevenue.toFixed(2)}\n`;
    csv += `Total Transactions,${totalTransactions}\n`;
    csv += `Best Selling Item,"${bestSelling ? bestSelling.name : "N/A"} (${bestSelling ? bestSelling.quantity : 0} units)"\n\n`;
    csv += "PAYMENT BREAKDOWN\n";
    csv += "Payment Method,Amount (₱)\n";
    paymentBreakdown.forEach((pb) => {
      csv += `${pb.method},${pb.amount.toFixed(2)}\n`;
    });
    csv += "\nTRANSACTION DETAILS\n";
    csv += "No.,Time,Total (₱),Payment Method\n";
    dailyTransactions.forEach((trans, idx) => {
      csv += `${idx + 1},${new Date(trans.date).toLocaleTimeString()},${trans.amount.toFixed(2)},${trans.paymentMethod}\n`;
    });

    const element = document.createElement("a");
    element.setAttribute(
      "href",
      "data:text/csv;charset=utf-8," + encodeURIComponent(csv)
    );
    element.setAttribute(
      "download",
      `Daily_Report_${today.replace(/\//g, "-")}.csv`
    );
    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const exportMonthlyReportToCSV = () => {
    const now = new Date();
    const monthYear = now.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
    });
    const totalRevenue = getMonthlyTotalRevenue();
    const totalTransactions = getMonthlyTotalTransactions();
    const averageSales = getAverageDailySales();
    const mostProfitable = getMostProfitableItem();
    const monthlyPerformance = getMonthlyPerformance();

    let csv = "La Tia Fanny POS - Monthly Sales Report\n";
    csv += `Month: ${monthYear}\n\n`;
    csv += "SUMMARY\n";
    csv += `Total Monthly Revenue (₱),${totalRevenue.toFixed(2)}\n`;
    csv += `Total Transactions,${totalTransactions}\n`;
    csv += `Average Daily Sales (₱),${averageSales.toFixed(2)}\n`;
    csv += `Most Profitable Item,"${mostProfitable ? mostProfitable.name : "N/A"}"\n`;
    csv += `Total Profit (₱),${mostProfitable ? mostProfitable.profit.toFixed(2) : "0.00"}\n\n`;
    csv += "SALES PER DAY\n";
    csv += "Day,Revenue (₱)\n";
    monthlyPerformance.forEach((day) => {
      if (day.amount > 0) {
        csv += `Day ${day.day},${day.amount.toFixed(2)}\n`;
      }
    });

    const element = document.createElement("a");
    element.setAttribute(
      "href",
      "data:text/csv;charset=utf-8," + encodeURIComponent(csv)
    );
    element.setAttribute(
      "download",
      `Monthly_Report_${monthYear.replace(/\s+/g, "_")}.csv`
    );
    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const printDailyReport = () => {
    window.print();
  };

  const printMonthlyReport = () => {
    window.print();
  };

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
          {currentPage === "settings" && "Settings"}
        </h1>
        <p>Point of Sale System - Admin Panel</p>
        
        {currentPage === "dashboard" && (
          <div className="dashboard-cards">
            <div className="card">
              <h3>Orders</h3>
              <p className="card-value">0</p>
            </div>
            <div className="card">
              <h3>Revenue</h3>
              <p className="card-value">₱0.00</p>
            </div>
            <div className="card">
              <h3>Customers</h3>
              <p className="card-value">0</p>
            </div>
            <div className="card">
              <h3>Products</h3>
              <p className="card-value">{items.length}</p>
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
                    <button onClick={addInventoryItem} className="add-ingredient-btn">
                      ADD INGREDIENT
                    </button>
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
                    {inventory.map((item) => (
                      <div key={item.id} className="table-row">
                        <div className="col-ingredient">
                          <span className="delete-icon">🗑</span>
                          <span className="duplicate-icon">📋</span>
                          <span className="item-name">{item.name}</span>
                        </div>
                        <div className="col-beginning"><span>0</span></div>
                        <div className="col-added"><span>0</span></div>
                        <div className="col-deducted"><span>0</span></div>
                        <div className="col-current"><span>{item.quantity}</span></div>
                        <div className="col-start"><input type="number" /></div>
                        <div className="col-actions">
                          <button className="add-action-btn">+</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {inventoryView === "ingredients" && (
              <div className="inventory-content">
                <p>Link Ingredients - Coming Soon</p>
              </div>
            )}
          </div>
        )}

        {currentPage === "items" && (
          <div className="items-page">
            <div className="items-tabs">
              <button
                className={`tab-btn ${itemView === "item" ? "active" : ""}`}
                onClick={() => setItemView("item")}
              >
                ITEM VIEW
              </button>
              <button
                className={`tab-btn ${itemView === "table" ? "active" : ""}`}
                onClick={() => setItemView("table")}
              >
                TABLE VIEW
              </button>
              <button
                className={`tab-btn ${itemView === "modifiers" ? "active" : ""}`}
                onClick={() => setItemView("modifiers")}
              >
                MODIFIERS
              </button>
            </div>

            {itemView === "item" && (
              <div className="items-view-content">
                <div className="category-form">
                  <input
                    type="text"
                    placeholder="Category Name"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && addCategory()}
                  />
                  <button onClick={addCategory} className="add-category-btn">
                    ADD CATEGORY
                  </button>
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
                              onClick={() => setEditingCategoryId(String(category.id))}
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
                        {editingCategoryId === String(category.id) && (
                          <div className="inline-item-form">
                            <input
                              type="text"
                              placeholder="Item name"
                              value={inlineItemForm.name}
                              onChange={(e) =>
                                setInlineItemForm({ ...inlineItemForm, name: e.target.value })
                              }
                            />
                            <input
                              type="number"
                              placeholder="Cost"
                              step="0.01"
                              value={inlineItemForm.cost}
                              onChange={(e) =>
                                setInlineItemForm({ ...inlineItemForm, cost: e.target.value })
                              }
                            />
                            <input
                              type="number"
                              placeholder="Price"
                              step="0.01"
                              value={inlineItemForm.price}
                              onChange={(e) =>
                                setInlineItemForm({ ...inlineItemForm, price: e.target.value })
                              }
                            />
                            <button
                              onClick={() => saveInlineItem(category.name)}
                              className="save-items-btn"
                            >
                              SAVE ITEMS
                            </button>
                          </div>
                        )}
                        {items
                          .filter((item) => item.category === category.name)
                          .map((item) => (
                            <div key={item.id} className="category-item-row">
                              <div className="item-pic-placeholder">Drop Picture Here</div>
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
            )}

            {itemView === "table" && (
              <div className="items-view-content">
                <p>Table View - Coming Soon</p>
              </div>
            )}

            {itemView === "modifiers" && (
              <div className="items-view-content">
                <p>Modifiers - Coming Soon</p>
              </div>
            )}
          </div>
        )}

        {currentPage === "reports" && (
          <div className="reports-page">
            <div className="reports-tabs">
              <button
                className={`report-tab-btn ${reportsView === "daily" ? "active" : ""}`}
                onClick={() => setReportsView("daily")}
              >
                Daily Report
              </button>
              <button
                className={`report-tab-btn ${reportsView === "monthly" ? "active" : ""}`}
                onClick={() => setReportsView("monthly")}
              >
                Monthly Report
              </button>
              <button
                className={`report-tab-btn ${reportsView === "inventory" ? "active" : ""}`}
                onClick={() => setReportsView("inventory")}
              >
                Inventory Report
              </button>
            </div>

            {reportsView === "daily" && (
              <div className="report-content">
                <div className="report-actions">
                  <button onClick={exportDailyReportToCSV} className="export-btn">
                    📊 Export to Excel
                  </button>
                  <button onClick={printDailyReport} className="print-btn">
                    🖨️ Print Report
                  </button>
                </div>
                <div className="report-grid">
                  <div className="report-card">
                    <h3>Total Revenue</h3>
                    <p className="report-value">₱{getDailyTotalRevenue().toFixed(2)}</p>
                  </div>
                  <div className="report-card">
                    <h3>Total Transactions</h3>
                    <p className="report-value">{getDailyTotalTransactions()}</p>
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
                          <span className="method-amount">₱{payment.amount.toFixed(2)}</span>
                        </div>
                      ))
                    ) : (
                      <p className="no-data">No transactions today</p>
                    )}
                  </div>
                </div>

                <div className="transactions-table">
                  <h2>Transaction Details</h2>
                  {getDailyTransactions().length > 0 ? (
                    <table className="daily-transactions">
                      <thead>
                        <tr>
                          <th>No.</th>
                          <th>Time</th>
                          <th>Total (₱)</th>
                          <th>Payment Method</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getDailyTransactions().map((transaction, idx) => (
                          <tr key={transaction.id}>
                            <td>{idx + 1}</td>
                            <td>{new Date(transaction.date).toLocaleTimeString()}</td>
                            <td>₱{transaction.amount.toFixed(2)}</td>
                            <td className="capitalize">{transaction.paymentMethod}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="no-data">No transactions today</p>
                  )}
                </div>
              </div>
            )}

            {reportsView === "monthly" && (
              <div className="report-content">
                <div className="report-actions">
                  <button onClick={exportMonthlyReportToCSV} className="export-btn">
                    📊 Export to Excel
                  </button>
                  <button onClick={printMonthlyReport} className="print-btn">
                    🖨️ Print Report
                  </button>
                </div>
                <div className="report-grid">
                  <div className="report-card">
                    <h3>Total Monthly Revenue</h3>
                    <p className="report-value">₱{getMonthlyTotalRevenue().toFixed(2)}</p>
                  </div>
                  <div className="report-card">
                    <h3>Total Transactions</h3>
                    <p className="report-value">{getMonthlyTotalTransactions()}</p>
                  </div>
                  <div className="report-card">
                    <h3>Average Daily Sales</h3>
                    <p className="report-value">₱{getAverageDailySales().toFixed(2)}</p>
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
                        ? `Profit: ₱${getMostProfitableItem()!.profit.toFixed(2)}`
                        : ""}
                    </p>
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
                            <span className="day-number">Day {day.day}</span>
                            <div className="day-bar-container">
                              <div
                                className="day-bar"
                                style={{
                                  width: `${(day.amount / Math.max(...getMonthlyPerformance().map((d) => d.amount))) * 100}%`,
                                }}
                              />
                            </div>
                            <span className="day-amount">₱{day.amount.toFixed(2)}</span>
                          </div>
                        ))
                    ) : (
                      <p className="no-data">No sales data for this month</p>
                    )}
                  </div>
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
                            <span className="alert-icon">⚠️</span>
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
                            <span className="alert-icon">🚫</span>
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
                    ×
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
      </div>
    </div>
  );
}

export default Admin;
