import { useState, useEffect } from "react";
import "./App.css";

const dayNames = [
  "شنبه",
  "یکشنبه",
  "دوشنبه",
  "سه‌شنبه",
  "چهارشنبه",
  "پنجشنبه",
  "جمعه",
];

const getWeekStart = (offset = 0) => {
  const today = new Date();
  const start = new Date(today);
  const daysSinceSaturday = (today.getDay() + 1) % 7;

  start.setDate(today.getDate() - daysSinceSaturday + offset * 7);
  start.setHours(0, 0, 0, 0);

  return start;
};

const getDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

function App() {
  const [selectedDay, setSelectedDay] = useState(4);
  const [weekOffset, setWeekOffset] = useState(0);
  const [modalDay, setModalDay] = useState(0);

  const [meals, setMeals] = useState(() => {
    const savedMeals = localStorage.getItem("yamipick-meals");
    const parsedMeals = savedMeals ? JSON.parse(savedMeals) : {};
    const migratedMeals = { ...parsedMeals };

    dayNames.forEach((_, index) => {
      const date = getWeekStart(0);
      date.setDate(date.getDate() + index);

      const dateKey = getDateKey(date);

      ["lunch", "dinner"].forEach((type) => {
        const oldKey = `${index}-${type}`;
        const newKey = `${dateKey}-${type}`;

        if (
          parsedMeals[oldKey] &&
          !Object.prototype.hasOwnProperty.call(migratedMeals, newKey)
        ) {
          migratedMeals[newKey] = parsedMeals[oldKey];
        }
      });
    });

    return migratedMeals;
  });

  const [foods, setFoods] = useState(() => {
    const savedFoods = localStorage.getItem("yamipick-foods");
    return savedFoods ? JSON.parse(savedFoods) : [];
  });
  const [searchFood, setSearchFood] = useState("");
  const [shoppingList, setShoppingList] = useState(() => {
    const savedList = localStorage.getItem("yamipick-shopping");
    return savedList ? JSON.parse(savedList) : [];
  });

  const [newShoppingItem, setNewShoppingItem] = useState("");
  const [newFood, setNewFood] = useState("");
  const [modal, setModal] = useState(null);
  const [foodName, setFoodName] = useState("");
  const [selectedFood, setSelectedFood] = useState("");
  const [assignmentMeal, setAssignmentMeal] = useState("lunch");
  const weekDays = dayNames.map((name, index) => {
    const date = getWeekStart(weekOffset);
    date.setDate(date.getDate() + index);

    return {
      name,
      date: new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
        day: "numeric",
        month: "long",
      }).format(date),
      key: getDateKey(date),
    };
  });

  const weekParts = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    month: "long",
    year: "numeric",
  }).formatToParts(getWeekStart(weekOffset));

  const weekMonth = weekParts.find((part) => part.type === "month").value;
  const weekYear = weekParts.find((part) => part.type === "year").value;

  const weekTitle = `${weekMonth} ${weekYear}`;
  const days = weekDays;
  useEffect(() => {
    localStorage.setItem("yamipick-meals", JSON.stringify(meals));
  }, [meals]);
  useEffect(() => {
    localStorage.setItem("yamipick-foods", JSON.stringify(foods));
  }, [foods]);
  useEffect(() => {
    localStorage.setItem("yamipick-shopping", JSON.stringify(shoppingList));
  }, [shoppingList]);

  const addFood = () => {
    const name = newFood.trim();

    if (!name) return;

    if (foods.some((food) => food.toLowerCase() === name.toLowerCase())) {
      alert("این غذا قبلاً در بانک غذا ثبت شده!");
      return;
    }

    setFoods((prev) => [...prev, name]);
    setNewFood("");
  };
  const addShoppingItem = () => {
    const name = newShoppingItem.trim();

    if (!name) return;

    setShoppingList((prev) => [
      ...prev,
      {
        id: Date.now(),
        name,
        purchased: false,
        price: 0,
      },
    ]);

    setNewShoppingItem("");
  };
  const togglePurchased = (id) => {
    setShoppingList((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, purchased: !item.purchased } : item,
      ),
    );
  };
  const deleteShoppingItem = (id) => {
    setShoppingList((prev) => prev.filter((item) => item.id !== id));
  };

  const openAssignModal = (food) => {
    setSelectedFood(food);
    setModalDay(selectedDay);
    setAssignmentMeal("lunch");
    setModal("assign");
  };

  const deleteFood = (food) => {
    setFoods((prev) => prev.filter((item) => item !== food));
  };
  const openModal = (type, dayIndex = selectedDay) => {
    setModalDay(dayIndex);
    setFoodName(meals[`${days[dayIndex].key}-${type}`] || "");
    setModal(type);
  };

  const saveMeal = () => {
    if (modal === "assign") {
      if (!selectedFood) return;
      const key = `${days[modalDay].key}-${assignmentMeal}`;
      setMeals((prev) => ({ ...prev, [key]: selectedFood }));
      setModal(null);
      setSelectedFood("");
      return;
    }

    const key = `${days[modalDay].key}-${modal}`;
    if (!foodName.trim()) return;

    setMeals((prev) => ({
      ...prev,
      [key]: foodName.trim(),
    }));

    setModal(null);
    setFoodName("");
  };

  const deleteMeal = (type, dayIndex = selectedDay) => {
    const key = `${days[dayIndex].key}-${type}`;

    setMeals((prev) => {
      const updated = { ...prev };
      delete updated[key];
      return updated;
    });

    setModal(null);
  };
  const filteredFoods = foods.filter((food) =>
    food.toLowerCase().includes(searchFood.toLowerCase()),
  );

  const renderMeal = (type, title, icon, className) => {
    const food = meals[`${days[selectedDay].key}-${type}`];
    return (
      <div className={`meal-card ${className}`}>
        <div className="meal-info">
          <span className="meal-icon">{icon}</span>
          <div>
            <span className="meal-label">{title}</span>
            <h3>{food || "هنوز غذایی انتخاب نکردی"}</h3>
            {!food && <p>برای این وعده غذا انتخاب کن.</p>}
          </div>
        </div>

        <div className="meal-actions">
          <button className="add-button" onClick={() => openModal(type)}>
            {food ? "✏️ ویرایش غذا" : "＋ افزودن غذا"}
          </button>

          {food && (
            <button className="delete-button" onClick={() => deleteMeal(type)}>
              حذف
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="app" dir="rtl">
      <header className="topbar">
        <div className="brand">
          <span className="brand-icon">🍓</span>
          <span>YamiPick</span>
        </div>
        <button className="profile">👩🏻</button>
      </header>

      <main className="main-content">
        <section className="welcome">
          <div>
            <p className="eyebrow">خوش اومدی به یامی‌پیک!</p>
            <h1>امروز چی بخوریم؟ 😋</h1>
            <p className="subtitle">برای خوشمزه‌تر شدن روزت برنامه بچین.</p>
          </div>
          <div className="welcome-emoji">🥑</div>
        </section>

        <section className="week-section">
          <div className="section-heading">
            <div>
              <h2>برنامه غذایی من</h2>
              <p>{weekTitle}</p>
            </div>

            <div className="week-navigation">
              <button onClick={() => setWeekOffset((prev) => prev - 1)}>
                هفته قبل
              </button>

              <button onClick={() => setWeekOffset((prev) => prev + 1)}>
                هفته بعد
              </button>
            </div>
          </div>

          <div className="week-days">
            {days.map((day, index) => (
              <button
                key={day.name}
                className={`day ${selectedDay === index ? "active" : ""}`}
                onClick={() => setSelectedDay(index)}
              >
                <span>{day.name}</span>
                <span>{day.date}</span>
              </button>
            ))}
          </div>

          <div className="daily-meals">
            <h3>
              برنامه {days[selectedDay].name} {days[selectedDay].date}
            </h3>

            {renderMeal("lunch", "ناهار", "☀️", "lunch-card")}

            {renderMeal("dinner", "شام", "🌙", "dinner-card")}
          </div>
        </section>
        <div className="planning-layout">
          <section className="weekly-overview">
            <div className="weekly-heading">
              <h2>📅 برنامه غذایی هفته</h2>
              <p>ناهار و شام تمام روزهای هفته</p>
            </div>

            <div className="weekly-grid">
              {days.map((day, index) => (
                <div className="weekly-day-card" key={day.name}>
                  <div className="weekly-day-heading">
                    <strong>{day.name}</strong>
                    <span>{day.date}</span>
                  </div>

                  <div className="weekly-meals">
                    <button
                      className="weekly-meal-button lunch-meal"
                      onClick={() => openModal("lunch", index)}
                    >
                      <span>☀️</span>
                      <span>{meals[`${day.key}-lunch`] || "افزودن ناهار"}</span>
                    </button>

                    <button
                      className="weekly-meal-button dinner-meal"
                      onClick={() => openModal("dinner", index)}
                    >
                      <span>🌙</span>
                      <span>{meals[`${day.key}-dinner`] || "افزودن شام"}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="food-bank">
            <div className="food-bank-heading">
              <div>
                <h2>🍲 بانک غذاهای من</h2>
                <p>غذاهای خوشمزه‌ات رو اینجا نگه دار.</p>
              </div>
              <span className="food-count">{foods.length} غذا</span>
            </div>

            <div className="food-input-row">
              <input
                type="text"
                value={newFood}
                onChange={(e) => setNewFood(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addFood()}
              />
              <button onClick={addFood}>＋ ثبت غذا</button>
            </div>

            <input
              className="food-search"
              type="text"
              value={searchFood}
              onChange={(e) => setSearchFood(e.target.value)}
              placeholder="🔍 جست‌وجوی غذا..."
            />

            {foods.length === 0 ? (
              <div className="empty-foods">
                <span>🥗</span>
                <p>هنوز غذایی ثبت نکردی. اولین غذای خوشمزه‌ات رو اضافه کن!</p>
              </div>
            ) : filteredFoods.length === 0 ? (
              <p className="no-food-result">غذایی با این نام پیدا نشد.</p>
            ) : (
              <div className="food-list">
                {filteredFoods.map((food, index) => (
                  <div className="food-item" key={food}>
                    <div className="food-name">
                      <span>🍽️</span>
                      <strong>{food}</strong>
                    </div>

                    <div className="food-item-actions">
                      <button
                        className="assign-food-button"
                        onClick={() => openAssignModal(food)}
                      >
                        ＋ افزودن به برنامه
                      </button>
                      <button
                        className="remove-food"
                        onClick={() => deleteFood(food)}
                        title="حذف غذا"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
        <section className="shopping-section">
          <div className="shopping-heading">
            <div>
              <h2>🛒 لیست خرید من</h2>
              <p>چیزهایی که باید بخریم.</p>
            </div>
            <span className="shopping-count">
              {shoppingList.filter((item) => !item.purchased).length} باقی‌مانده
            </span>
          </div>

          <div className="shopping-input-row">
            <input
              type="text"
              value={newShoppingItem}
              onChange={(e) => setNewShoppingItem(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addShoppingItem()}
            />
            <button onClick={addShoppingItem}>＋ افزودن</button>
          </div>

          {shoppingList.length === 0 ? (
            <div className="empty-shopping">
              <span>🛍️</span>
              <p>لیست خریدت هنوز خالیه!</p>
            </div>
          ) : (
            <div className="shopping-list">
              {shoppingList.map((item) => (
                <div
                  className={`shopping-item ${item.purchased ? "purchased" : ""}`}
                  key={item.id}
                >
                  <label className="shopping-item-name">
                    <input
                      type="checkbox"
                      checked={item.purchased}
                      onChange={() => togglePurchased(item.id)}
                    />
                    <span>{item.name}</span>
                  </label>

                  <button
                    className="shopping-delete"
                    onClick={() => deleteShoppingItem(item.id)}
                    title="حذف کالا"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
        <section className="tip">
          <span>💡</span>
          <p>یه برنامه خوب، خرید راحت‌تر و غذای خوشمزه‌تر!</p>
        </section>
      </main>

      <nav className="bottom-nav">
        <button className="nav-item selected">
          <span>🏠</span>
          <small>خانه</small>
        </button>
        <button className="nav-item">
          <span>📅</span>
          <small>تقویم</small>
        </button>
        <button className="nav-item">
          <span>🍲</span>
          <small>غذاها</small>
        </button>
        <button className="nav-item">
          <span>🛒</span>
          <small>خرید</small>
        </button>
      </nav>

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="food-modal" onClick={(e) => e.stopPropagation()}>
            <button className="close-modal" onClick={() => setModal(null)}>
              ×
            </button>

            {modal === "assign" ? (
              <>
                <span className="modal-emoji">🍽️</span>
                <h2>افزودن غذا به برنامه</h2>
                <p className="selected-food-name">{selectedFood}</p>

                <label className="assignment-label" htmlFor="assignment-day">
                  انتخاب روز
                </label>
                <select
                  id="assignment-day"
                  className="assignment-select"
                  value={modalDay}
                  onChange={(e) => setModalDay(Number(e.target.value))}
                >
                  {days.map((day, index) => (
                    <option key={day.name} value={index}>
                      {day.name}
                    </option>
                  ))}
                </select>

                <label className="assignment-label" htmlFor="assignment-meal">
                  انتخاب وعده
                </label>
                <select
                  id="assignment-meal"
                  className="assignment-select"
                  value={assignmentMeal}
                  onChange={(e) => setAssignmentMeal(e.target.value)}
                >
                  <option value="lunch">☀️ ناهار</option>
                  <option value="dinner">🌙 شام</option>
                </select>

                <button className="save-food" onClick={saveMeal}>
                  افزودن به برنامه
                </button>
              </>
            ) : (
              <>
                {meals[`${days[modalDay].key}-${modal}`] && (
                  <button
                    className="delete-button"
                    onClick={() => deleteMeal(modal, modalDay)}
                  >
                    🗑️ حذف این وعده
                  </button>
                )}

                <span className="modal-emoji">
                  {modal === "lunch" ? "☀️" : "🌙"}
                </span>
                <h2>
                  {modal === "lunch" ? "ناهار چی بخوریم؟" : "شام چی بخوریم؟"}
                </h2>
                <p>اسم غذای موردنظرت رو وارد کن.</p>
                <input
                  type="text"
                  value={foodName}
                  onChange={(e) => setFoodName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveMeal()}
                  autoFocus
                />
                <button className="save-food" onClick={saveMeal}>
                  ذخیره غذا
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
