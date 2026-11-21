import { useState, useEffect } from "react";
import { supabase } from "./lib/supabase";
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
  const [selectedDay, setSelectedDay] = useState(() => {
    const saved = localStorage.getItem("yamipick-selected-day");
    return saved !== null ? Number(saved) : 0;
  });
  useEffect(() => {
    localStorage.setItem("yamipick-selected-day", selectedDay);
  }, [selectedDay]);
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
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [authMode, setAuthMode] = useState("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [households, setHouseholds] = useState([]);
  const [activeHousehold, setActiveHousehold] = useState(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataMessage, setDataMessage] = useState("");
  const [householdBusy, setHouseholdBusy] = useState(false);
  const [householdMessage, setHouseholdMessage] = useState("");
  const [householdName, setHouseholdName] = useState("");
  const [householdLoading, setHouseholdLoading] = useState(true);
  const [inviteCodeInput, setInviteCodeInput] = useState("");
  const [showAccount, setShowAccount] = useState(false);

  const [copiedInviteCode, setCopiedInviteCode] = useState(null);
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
  const loadHouseholds = async (userId) => {
    if (!userId) {
      setHouseholds([]);
      setActiveHousehold(null);
      setHouseholdLoading(false);
      return [];
    }

    setHouseholdLoading(true);

    try {
      const { data, error } = await supabase
        .from("household_members")
        .select("household_id, role, households(id, name, invite_code)")
        .eq("user_id", userId);

      if (error) throw error;

      const list = (data || [])
        .map((item) => {
          const home = Array.isArray(item.households)
            ? item.households[0]
            : item.households;

          return home ? { ...home, role: item.role } : null;
        })
        .filter(Boolean);

      setHouseholds(list);

      setActiveHousehold(
        (current) =>
          list.find((item) => item.id === current?.id) || list[0] || null,
      );

      return list;
    } catch (error) {
      setHouseholdMessage(error.message);
      return [];
    } finally {
      setHouseholdLoading(false);
    }
  };
  useEffect(() => {
    if (session?.user?.id) {
      loadHouseholds(session.user.id);
    } else {
      setHouseholds([]);
      setActiveHousehold(null);
      setHouseholdLoading(false);
    }
  }, [session]);
  useEffect(() => {
    let cancelled = false;

    const loadHouseholdData = async () => {
      if (!session?.user?.id || !activeHousehold?.id) return;

      setDataLoading(true);
      setDataMessage("");

      try {
        const householdId = activeHousehold.id;

        const fetchRemoteData = async () => {
          const [mealsResult, foodsResult, shoppingResult] = await Promise.all([
            supabase
              .from("meal_entries")
              .select("meal_date, meal_type, food_name")
              .eq("household_id", householdId)
              .order("meal_date", { ascending: true }),

            supabase
              .from("foods")
              .select("id, name")
              .eq("household_id", householdId)
              .order("created_at", { ascending: true }),

            supabase
              .from("shopping_items")
              .select("id, name, purchased")
              .eq("household_id", householdId)
              .order("created_at", { ascending: true }),
          ]);

          if (mealsResult.error) throw mealsResult.error;
          if (foodsResult.error) throw foodsResult.error;
          if (shoppingResult.error) throw shoppingResult.error;

          return {
            meals: mealsResult.data || [],
            foods: foodsResult.data || [],
            shopping: shoppingResult.data || [],
          };
        };

        let remoteData = await fetchRemoteData();

        const migrationKey = "yamipick-cloud-migration-v1";
        const migrationDone = Boolean(localStorage.getItem(migrationKey));

        const readLocal = (key, fallback) => {
          try {
            const value = localStorage.getItem(key);
            return value ? JSON.parse(value) : fallback;
          } catch {
            return fallback;
          }
        };

        if (!migrationDone) {
          const localSnapshot = {
            meals: readLocal("yamipick-meals", {}),
            foods: readLocal("yamipick-foods", []),
            shopping: readLocal("yamipick-shopping", []),
          };

          const hasLocalData =
            Object.keys(localSnapshot.meals || {}).length > 0 ||
            (Array.isArray(localSnapshot.foods) &&
              localSnapshot.foods.length > 0) ||
            (Array.isArray(localSnapshot.shopping) &&
              localSnapshot.shopping.length > 0);

          const cloudIsEmpty =
            remoteData.meals.length === 0 &&
            remoteData.foods.length === 0 &&
            remoteData.shopping.length === 0;

          if (cloudIsEmpty) {
            const mealRows = Object.entries(localSnapshot.meals || []).flatMap(
              ([key, value]) => {
                const match = key.match(/^(\d{4}-\d{2}-\d{2})-(lunch|dinner)$/);

                if (!match || typeof value !== "string" || !value.trim()) {
                  return [];
                }

                return [
                  {
                    household_id: householdId,
                    meal_date: match[1],
                    meal_type: match[2],
                    food_name: value.trim(),
                  },
                ];
              },
            );

            if (mealRows.length > 0) {
              const { error } = await supabase
                .from("meal_entries")
                .upsert(mealRows, {
                  onConflict: "household_id,meal_date,meal_type",
                });

              if (error) throw error;
            }

            const { data: existingFoods, error: existingFoodsError } =
              await supabase
                .from("foods")
                .select("name")
                .eq("household_id", householdId);

            if (existingFoodsError) throw existingFoodsError;

            const existingFoodNames = new Set(
              (existingFoods || []).map((item) => item.name.toLowerCase()),
            );

            const uniqueLocalFoods = [
              ...new Map(
                (Array.isArray(localSnapshot.foods) ? localSnapshot.foods : [])
                  .filter((name) => typeof name === "string" && name.trim())
                  .map((name) => [name.trim().toLowerCase(), name.trim()]),
              ).values(),
            ];

            const foodRows = uniqueLocalFoods
              .filter((name) => !existingFoodNames.has(name.toLowerCase()))
              .map((name) => ({
                household_id: householdId,
                name,
              }));

            if (foodRows.length > 0) {
              const { error } = await supabase.from("foods").insert(foodRows);

              if (error) throw error;
            }

            const { data: existingShopping, error: existingShoppingError } =
              await supabase
                .from("shopping_items")
                .select("name, purchased")
                .eq("household_id", householdId);

            if (existingShoppingError) throw existingShoppingError;

            const shoppingCounts = new Map();

            (existingShopping || []).forEach((item) => {
              const key = `${item.name.toLowerCase()}-${Boolean(item.purchased)}`;
              shoppingCounts.set(key, (shoppingCounts.get(key) || 0) + 1);
            });

            const shoppingRows = [];

            (Array.isArray(localSnapshot.shopping)
              ? localSnapshot.shopping
              : []
            ).forEach((item) => {
              if (!item || typeof item.name !== "string" || !item.name.trim()) {
                return;
              }

              const name = item.name.trim();
              const purchased = Boolean(item.purchased);
              const key = `${name.toLowerCase()}-${purchased}`;
              const count = shoppingCounts.get(key) || 0;

              if (count > 0) {
                shoppingCounts.set(key, count - 1);
              } else {
                shoppingRows.push({
                  household_id: householdId,
                  name,
                  purchased,
                });
              }
            });

            if (shoppingRows.length > 0) {
              const { error } = await supabase
                .from("shopping_items")
                .insert(shoppingRows);

              if (error) throw error;
            }

            localStorage.setItem(migrationKey, "done");
            remoteData = await fetchRemoteData();
          } else {
            if (hasLocalData) {
              localStorage.setItem(
                "yamipick-local-backup-before-cloud",
                JSON.stringify(localSnapshot),
              );

              setDataMessage(
                "اطلاعات آنلاین از قبل وجود داشت؛ نسخه قبلی اطلاعات این مرورگر جداگانه نگه‌داری شد.",
              );
            }

            localStorage.setItem(migrationKey, "skipped-cloud-not-empty");
          }
        }

        if (cancelled) return;

        setMeals(
          Object.fromEntries(
            remoteData.meals.map((item) => [
              `${item.meal_date}-${item.meal_type}`,
              item.food_name,
            ]),
          ),
        );

        setFoods(remoteData.foods.map((item) => item.name));

        setShoppingList(
          remoteData.shopping.map((item) => ({
            id: item.id,
            name: item.name,
            purchased: item.purchased,
            price: 0,
          })),
        );
      } catch (error) {
        if (!cancelled) {
          setDataMessage(error.message || "دریافت اطلاعات با مشکل مواجه شد.");
        }
      } finally {
        if (!cancelled) {
          setDataLoading(false);
        }
      }
    };

    loadHouseholdData();

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, activeHousehold?.id]);
  useEffect(() => {
    if (!session?.user?.id || !activeHousehold?.id) return;

    let cancelled = false;
    const householdId = activeHousehold.id;

    const refreshHouseholdData = async () => {
      try {
        const [mealsResult, foodsResult, shoppingResult] = await Promise.all([
          supabase
            .from("meal_entries")
            .select("meal_date, meal_type, food_name")
            .eq("household_id", householdId),

          supabase
            .from("foods")
            .select("id, name")
            .eq("household_id", householdId),

          supabase
            .from("shopping_items")
            .select("id, name, purchased")
            .eq("household_id", householdId),
        ]);

        if (mealsResult.error) throw mealsResult.error;
        if (foodsResult.error) throw foodsResult.error;
        if (shoppingResult.error) throw shoppingResult.error;

        if (cancelled) return;

        setMeals(
          Object.fromEntries(
            mealsResult.data.map((item) => [
              `${item.meal_date}-${item.meal_type}`,
              item.food_name,
            ]),
          ),
        );

        setFoods(foodsResult.data.map((item) => item.name));

        setShoppingList(
          shoppingResult.data.map((item) => ({
            id: item.id,
            name: item.name,
            purchased: item.purchased,
            price: 0,
          })),
        );
      } catch (error) {
        if (!cancelled) {
          console.error("Realtime sync error:", error);
        }
      }
    };

    const channel = supabase
      .channel(`household-${householdId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "meal_entries",
          filter: `household_id=eq.${householdId}`,
        },
        refreshHouseholdData,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "foods",
          filter: `household_id=eq.${householdId}`,
        },
        refreshHouseholdData,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "shopping_items",
          filter: `household_id=eq.${householdId}`,
        },
        refreshHouseholdData,
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id, activeHousehold?.id]);
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setAuthLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    localStorage.setItem("yamipick-meals", JSON.stringify(meals));
  }, [meals]);
  useEffect(() => {
    localStorage.setItem("yamipick-foods", JSON.stringify(foods));
  }, [foods]);
  useEffect(() => {
    localStorage.setItem("yamipick-shopping", JSON.stringify(shoppingList));
  }, [shoppingList]);
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthMessage("");

    const email = authEmail.trim();

    if (!email || !authPassword) {
      setAuthMessage("ایمیل و رمز عبور رو وارد کن.");
      return;
    }

    if (authMode === "signup" && authPassword.length < 6) {
      setAuthMessage("رمز عبور باید حداقل ۶ کاراکتر باشه.");
      return;
    }

    setAuthBusy(true);

    try {
      if (authMode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password: authPassword,
          options: {
            emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}`,
          },
        });

        if (error) throw error;

        if (data.session) {
          setAuthMessage("ثبت‌نام موفق بود!");
        } else {
          setAuthMessage("حساب ساخته شد. برای فعال‌سازی، ایمیلت رو بررسی کن.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password: authPassword,
        });

        if (error) throw error;
      }
    } catch (error) {
      if (error.message.includes("Invalid login credentials")) {
        setAuthMessage("ایمیل یا رمز عبور اشتباهه.");
      } else {
        setAuthMessage(error.message || "خطایی رخ داد.");
      }
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      setAuthMessage("خروج انجام نشد. دوباره تلاش کن.");
    }
  };
  const createHousehold = async () => {
    const name = householdName.trim();

    if (!name) {
      setHouseholdMessage("اسم فضا رو وارد کن.");
      return;
    }

    setHouseholdBusy(true);
    setHouseholdMessage("");

    try {
      const { data, error } = await supabase.rpc("create_household", {
        _name: name,
      });

      if (error) throw error;

      const created = Array.isArray(data) ? data[0] : data;

      const newHousehold = {
        id: created.household_id,
        name,
        invite_code: created.invite_code,
        role: "owner",
      };

      setHouseholds((prev) => [
        newHousehold,
        ...prev.filter((item) => item.id !== newHousehold.id),
      ]);

      setActiveHousehold(newHousehold);
      setHouseholdName("");
      setHouseholdMessage("فضای جدید با موفقیت ساخته شد!");
    } catch (error) {
      setHouseholdMessage(error.message);
    } finally {
      setHouseholdBusy(false);
    }
  };

  const joinHousehold = async () => {
    if (!inviteCodeInput.trim()) {
      setHouseholdMessage("کد دعوت رو وارد کن.");
      return;
    }

    setHouseholdBusy(true);
    setHouseholdMessage("");

    try {
      const { data, error } = await supabase.rpc("join_household", {
        _invite_code: inviteCodeInput.trim(),
      });

      if (error) throw error;

      const list = await loadHouseholds(session.user.id);

      const joined = list.find((item) => item.id === data);

      if (joined) {
        setActiveHousehold(joined);
      }

      setInviteCodeInput("");
      setHouseholdMessage("با موفقیت عضو فضای مشترک شدی!");
    } catch (error) {
      setHouseholdMessage(error.message);
    } finally {
      setHouseholdBusy(false);
    }
  };
  const addFood = async () => {
    const name = newFood.trim();

    if (!name || !activeHousehold?.id) return;

    if (foods.some((food) => food.toLowerCase() === name.toLowerCase())) {
      alert("این غذا قبلاً توی بانک غذا ثبت شده!");
      return;
    }

    setDataLoading(true);
    setDataMessage("");

    const { data, error } = await supabase
      .from("foods")
      .insert({
        household_id: activeHousehold.id,
        name,
      })
      .select("id, name")
      .single();

    setDataLoading(false);

    if (error) {
      setDataMessage("ثبت غذا انجام نشد: " + error.message);
      return;
    }

    setFoods((prev) => [...prev, data.name]);
    setNewFood("");
  };
  const addShoppingItem = async () => {
    const name = newShoppingItem.trim();

    if (!name || !activeHousehold?.id) return;

    setDataLoading(true);
    setDataMessage("");

    const { data, error } = await supabase
      .from("shopping_items")
      .insert({
        household_id: activeHousehold.id,
        name,
        purchased: false,
      })
      .select("id, name, purchased")
      .single();

    setDataLoading(false);

    if (error) {
      setDataMessage("ثبت کالا انجام نشد: " + error.message);
      return;
    }

    setShoppingList((prev) => [
      ...prev,
      {
        id: data.id,
        name: data.name,
        purchased: data.purchased,
        price: 0,
      },
    ]);

    setNewShoppingItem("");
  };
  const togglePurchased = async (id) => {
    if (!activeHousehold?.id) return;

    const item = shoppingList.find((item) => item.id === id);
    if (!item) return;

    const newPurchased = !item.purchased;

    setDataLoading(true);
    setDataMessage("");

    const { error } = await supabase
      .from("shopping_items")
      .update({ purchased: newPurchased })
      .eq("id", id)
      .eq("household_id", activeHousehold.id);

    setDataLoading(false);

    if (error) {
      setDataMessage("تغییر وضعیت خرید انجام نشد: " + error.message);
      return;
    }

    setShoppingList((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, purchased: newPurchased } : item,
      ),
    );
  };
  const deleteShoppingItem = async (id) => {
    if (!activeHousehold?.id) return;

    setDataLoading(true);
    setDataMessage("");

    const { error } = await supabase
      .from("shopping_items")
      .delete()
      .eq("id", id)
      .eq("household_id", activeHousehold.id);

    setDataLoading(false);

    if (error) {
      setDataMessage("حذف کالا انجام نشد: " + error.message);
      return;
    }

    setShoppingList((prev) => prev.filter((item) => item.id !== id));
  };

  const openAssignModal = (food) => {
    setSelectedFood(food);
    setModalDay(selectedDay);
    setAssignmentMeal("lunch");
    setModal("assign");
  };

  const deleteFood = async (food) => {
    if (!activeHousehold?.id) return;

    setDataLoading(true);
    setDataMessage("");

    const { error } = await supabase
      .from("foods")
      .delete()
      .eq("household_id", activeHousehold.id)
      .eq("name", food);

    setDataLoading(false);

    if (error) {
      setDataMessage("حذف غذا انجام نشد: " + error.message);
      return;
    }

    setFoods((prev) => prev.filter((item) => item !== food));
  };
  const openModal = (type, dayIndex = selectedDay) => {
    setModalDay(dayIndex);
    setFoodName(meals[`${days[dayIndex].key}-${type}`] || "");
    setModal(type);
  };

  const saveMeal = async () => {
    if (!activeHousehold?.id) return;

    let key;
    let food;

    if (modal === "assign") {
      if (!selectedFood) return;

      key = `${days[modalDay].key}-${assignmentMeal}`;
      food = selectedFood;
    } else {
      key = `${days[modalDay].key}-${modal}`;
      food = foodName.trim();

      if (!food) return;
    }

    const [mealDate, mealType] = [key.slice(0, 10), key.slice(11)];

    setDataLoading(true);
    setDataMessage("");

    const { error } = await supabase.from("meal_entries").upsert(
      {
        household_id: activeHousehold.id,
        meal_date: mealDate,
        meal_type: mealType,
        food_name: food,
      },
      {
        onConflict: "household_id,meal_date,meal_type",
      },
    );

    setDataLoading(false);

    if (error) {
      setDataMessage("ذخیره غذا انجام نشد: " + error.message);
      return;
    }

    setMeals((prev) => ({
      ...prev,
      [key]: food,
    }));

    setModal(null);
    setSelectedFood("");
    setFoodName("");
  };

  const deleteMeal = async (type, dayIndex = selectedDay) => {
    if (!activeHousehold?.id) return;

    const key = `${days[dayIndex].key}-${type}`;
    const mealDate = key.slice(0, 10);

    setDataLoading(true);
    setDataMessage("");

    const { error } = await supabase
      .from("meal_entries")
      .delete()
      .eq("household_id", activeHousehold.id)
      .eq("meal_date", mealDate)
      .eq("meal_type", type);

    setDataLoading(false);

    if (error) {
      setDataMessage("حذف غذا انجام نشد: " + error.message);
      return;
    }

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
  if (authLoading) {
    return (
      <div className="auth-screen" dir="rtl">
        در حال بررسی حساب کاربری...
      </div>
    );
  }

  if (!session) {
    return (
      <div className="auth-screen" dir="rtl">
        <form className="auth-card" onSubmit={handleAuthSubmit}>
          <div className="auth-logo">🍽️</div>

          <h1>YamiPick</h1>

          <p>
            {authMode === "login"
              ? "خوش برگشتی! وارد حساب خودت شو."
              : "به خانواده یامی‌پیک خوش اومدی!"}
          </p>

          <label>
            ایمیل
            <input
              type="email"
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
              placeholder="example@email.com"
              required
            />
          </label>

          <label>
            رمز عبور
            <input
              type="password"
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              placeholder="حداقل ۶ کاراکتر"
              required
            />
          </label>

          {authMessage && <p className="auth-message">{authMessage}</p>}

          <button className="auth-submit" type="submit" disabled={authBusy}>
            {authBusy
              ? "لطفاً صبر کن..."
              : authMode === "login"
                ? "ورود به حساب"
                : "ساخت حساب"}
          </button>

          <button
            className="auth-switch"
            type="button"
            onClick={() => {
              setAuthMode(authMode === "login" ? "signup" : "login");
              setAuthMessage("");
            }}
          >
            {authMode === "login"
              ? "حساب نداری؟ ثبت‌نام کن"
              : "قبلاً ثبت‌نام کردی؟ وارد شو"}
          </button>
        </form>
      </div>
    );
  }
  if (householdLoading) {
    return (
      <div className="auth-screen" dir="rtl">
        در حال بارگذاری اطلاعات...
      </div>
    );
  }
  if (showAccount) {
    return (
      <div className="app" dir="rtl">
        <header className="topbar">
          <div className="brand">
            <span className="brand-icon">🍓</span>
            <span>YamiPick</span>
          </div>

          <button
            className="account-back"
            onClick={() => setShowAccount(false)}
          >
            بازگشت
          </button>
        </header>

        <main className="main-content account-page">
          <section className="account-panel">
            <h2>حساب کاربری من 👤</h2>
            <p>{session.user.email}</p>

            <div className="topbar-actions">
              <button
                className="profile"
                onClick={() => setShowAccount(true)}
                title="حساب کاربری"
              >
                👤
              </button>

              <button className="logout-button" onClick={handleSignOut}>
                خروج
              </button>
            </div>
          </section>

          <section className="account-panel">
            <h2>فضاهای من 🏡</h2>

            {householdLoading ? (
              <p>در حال بارگذاری فضاها...</p>
            ) : households.length === 0 ? (
              <p>هنوز عضو هیچ فضای مشترکی نیستی.</p>
            ) : (
              <div className="account-household-list">
                {households.map((home) => (
                  <div className="account-household" key={home.id}>
                    <div>
                      <strong>{home.name}</strong>
                      <small>
                        {home.role === "owner" ? "سازنده فضا" : "عضو فضا"}
                      </small>
                    </div>

                    <button
                      onClick={() => {
                        setActiveHousehold(home);
                        setShowAccount(false);
                      }}
                    >
                      انتخاب فضا
                    </button>

                    {home.role === "owner" && (
                      <div className="invite-code">
                        <div className="invite-code-details">
                          <span className="invite-code-label">
                            کد دعوت فضای شما
                          </span>

                          <code className="invite-code-value" dir="ltr">
                            {home.invite_code}
                          </code>
                        </div>

                        <button
                          className={`invite-copy-button ${
                            copiedInviteCode === home.id ? "copied" : ""
                          }`}
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(
                                home.invite_code,
                              );
                              setCopiedInviteCode(home.id);
                            } catch {
                              setHouseholdMessage(
                                "کپی خودکار انجام نشد؛ کد رو دستی کپی کن.",
                              );
                            }
                          }}
                        >
                          {copiedInviteCode === home.id ? "کپی شد ✓" : "کپی کد"}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="account-panel">
            <h2>＋ ساخت فضای جدید</h2>

            <input
              value={householdName}
              onChange={(e) => setHouseholdName(e.target.value)}
              placeholder="مثلاً خونه ما"
            />

            <button
              className="account-action"
              onClick={createHousehold}
              disabled={householdBusy}
            >
              {householdBusy ? "در حال ساخت..." : "ساخت فضای جدید"}
            </button>
          </section>

          <section className="account-panel">
            <h2>عضویت در فضای موجود</h2>

            <input
              value={inviteCodeInput}
              onChange={(e) => setInviteCodeInput(e.target.value)}
              placeholder="کد دعوت رو وارد کن"
              dir="ltr"
            />

            <button
              className="account-action"
              onClick={joinHousehold}
              disabled={householdBusy}
            >
              {householdBusy ? "در حال انجام..." : "عضویت"}
            </button>
          </section>

          {householdMessage && (
            <p className="household-message">{householdMessage}</p>
          )}
        </main>
      </div>
    );
  }
  if (households.length === 0) {
    return (
      <div className="app" dir="rtl">
        <header className="topbar">
          <div className="brand">
            <span className="brand-icon">🍓</span>
            <span>YamiPick</span>
          </div>

          <div className="topbar-actions">
            <button
              className="profile"
              onClick={() => setShowAccount(true)}
              title="حساب کاربری"
            >
              👤
            </button>

            <button className="logout-button" onClick={handleSignOut}>
              خروج
            </button>
          </div>
        </header>

        <main className="main-content onboarding-page">
          <section className="onboarding-card">
            <div className="welcome-emoji">🏡</div>

            <h1>به یامی‌پیک خوش اومدی!</h1>

            <p>برای شروع، فضای خودت رو بساز یا به یک فضای موجود ملحق شو.</p>

            <div className="onboarding-section">
              <h2>＋ ساخت فضای جدید</h2>

              <input
                value={householdName}
                onChange={(e) => setHouseholdName(e.target.value)}
                placeholder="برنامه غذایی من"
              />

              <button
                className="account-action"
                onClick={createHousehold}
                disabled={householdBusy}
              >
                {householdBusy ? "در حال ساخت..." : "ساخت فضای جدید"}
              </button>
            </div>

            <div className="onboarding-section">
              <h2>عضویت در فضای موجود</h2>

              <input
                value={inviteCodeInput}
                onChange={(e) => setInviteCodeInput(e.target.value)}
                placeholder="کد دعوت رو وارد کن"
              />

              <button
                className="account-action"
                onClick={joinHousehold}
                disabled={householdBusy}
              >
                {householdBusy ? "در حال انجام..." : "عضویت"}
              </button>
            </div>

            {householdMessage && (
              <p className="household-message">{householdMessage}</p>
            )}
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="app" dir="rtl">
      <header className="topbar">
        <div className="brand">
          <span className="brand-icon">🍓</span>
          <span>YamiPick</span>
        </div>
        <button
          className="profile"
          onClick={() => setShowAccount(true)}
          title="حساب کاربری"
        >
          👤
        </button>
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
