import { useEffect, useMemo, useState } from "react"
import { ArrowRight, CalendarDays, ChevronLeft, ChevronRight, Clock, UserRound } from "lucide-react"
import { useLocation, useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { ROUTES } from "@/constants/routes"
import {
  fetchAvailableTimeSlots,
  fetchReservationMenus,
  type ReservationMenuOption,
} from "@/features/user/api/userReservationApi"
import { UserSectionCard } from "@/features/user/components/UserSectionCard"
import { useAvailableTimeSlots } from "@/features/user/hooks/useAvailableTimeSlots"
import { useCustomerBookingRules } from "@/features/user/hooks/useCustomerBookingRules"
import { usePersistentReservationId } from "@/features/user/hooks/usePersistentReservationId"
import { buildPathWithShopId, useShopId } from "@/features/user/hooks/useShopId"
import { useShiftAvailableDates } from "@/features/user/hooks/useShiftAvailableDates"
import { useUserReservation } from "@/features/user/hooks/useUserReservation"
import { useUserTrainers } from "@/features/user/hooks/useUserTrainers"
import { formatDateShortWithWeekday } from "@/lib/dateFormat"

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"]

function parseDateKey(dateKey: string) {
  return new Date(`${dateKey}T00:00:00`)
}

function toDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function shiftMonth(base: Date, diff: number) {
  return new Date(base.getFullYear(), base.getMonth() + diff, 1)
}

function createCalendarDays(
  monthBase: Date,
  earliestBookableDate: Date,
  latestBookableDate: Date,
  shiftDateSet: Set<string> | null,
) {
  const firstDay = new Date(monthBase.getFullYear(), monthBase.getMonth(), 1)
  const monthStartWeekday = firstDay.getDay()
  const gridStart = new Date(firstDay)
  gridStart.setDate(firstDay.getDate() - monthStartWeekday)

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart)
    date.setDate(gridStart.getDate() + index)
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const dateKey = toDateKey(dayStart)
    return {
      dateKey,
      day: date.getDate(),
      weekday: date.getDay(),
      isCurrentMonth: date.getMonth() === monthBase.getMonth(),
      hasAvailability:
        dayStart.getTime() >= earliestBookableDate.getTime() &&
        dayStart.getTime() <= latestBookableDate.getTime() &&
        (shiftDateSet === null || shiftDateSet.has(dateKey)),
    }
  })
}

export function UserSchedulePage() {
  const shopId = useShopId()
  const navigate = useNavigate()
  const location = useLocation()
  const state = (location.state as {
    returnSearch?: string
    reservationId?: string
    isUpdatingExistingReservation?: boolean
  } | null) ?? null
  const returnSearch = state?.returnSearch ?? ""
  const isUpdateFlow = state?.isUpdatingExistingReservation === true
  const stateReservationId = (state?.reservationId ?? "").trim()
  const persistentReservationId = usePersistentReservationId()
  const reservationId = isUpdateFlow ? (stateReservationId || persistentReservationId).trim() : ""
  const { trainers } = useUserTrainers(shopId)
  const { reservation: currentReservation } = useUserReservation(reservationId, shopId)

  const [selectedDate, setSelectedDate] = useState<string>("")
  const [selectedTime, setSelectedTime] = useState<string>("")
  const [displayMonth, setDisplayMonth] = useState<Date>(new Date())
  const [currentReservationDate, setCurrentReservationDate] = useState("")
  const [currentReservationTime, setCurrentReservationTime] = useState("")
  const [menuOptions, setMenuOptions] = useState<ReservationMenuOption[]>([])
  const [selectedMenuId, setSelectedMenuId] = useState("")
  const [isLoadingMenus, setIsLoadingMenus] = useState(false)
  const [menuLoadError, setMenuLoadError] = useState("")
  const [assignMode, setAssignMode] = useState<"nomination" | "omakase" | "">("")
  const [selectedTrainerId, setSelectedTrainerId] = useState("")
  const [availableTrainerIds, setAvailableTrainerIds] = useState<Set<string> | null>(null)
  const [isLoadingAvailableTrainers, setIsLoadingAvailableTrainers] = useState(false)
  const bookingRules = useCustomerBookingRules(shopId)
  const selectedMenu = useMemo(
    () => menuOptions.find((menu) => menu.id === selectedMenuId),
    [menuOptions, selectedMenuId],
  )
  const selectedTrainer = useMemo(
    () => trainers.find((trainer) => trainer.id === selectedTrainerId),
    [trainers, selectedTrainerId],
  )
  const visibleTrainers = useMemo(() => {
    const sorted = trainers.slice().sort((a, b) => b.rating - a.rating)
    if (!availableTrainerIds) return sorted
    return sorted.filter((trainer) => availableTrainerIds.has(trainer.id))
  }, [trainers, availableTrainerIds])
  const shiftAvailableDates = useShiftAvailableDates(
    displayMonth,
    shopId,
    selectedMenu?.id,
    assignMode === "nomination" ? selectedTrainerId || undefined : undefined,
    isUpdateFlow && reservationId ? reservationId : undefined,
  )
  const availableTimeSlots = useAvailableTimeSlots(
    selectedDate,
    shopId,
    selectedMenu?.id,
    assignMode === "nomination" ? selectedTrainerId || undefined : undefined,
    isUpdateFlow && reservationId ? reservationId : undefined,
  )

  const earliestBookableDate = useMemo(() => {
    const now = new Date()
    const offset = bookingRules.allowSameDay ? 0 : 1
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset)
  }, [bookingRules.allowSameDay])
  const latestBookableDate = useMemo(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() + bookingRules.maxAdvanceDays)
  }, [bookingRules.maxAdvanceDays])
  const shiftDateSet = useMemo(() => {
    if (!shiftAvailableDates) return null
    return new Set(shiftAvailableDates)
  }, [shiftAvailableDates])
  const calendarDays = useMemo(
    () => createCalendarDays(displayMonth, earliestBookableDate, latestBookableDate, shiftDateSet),
    [displayMonth, earliestBookableDate, latestBookableDate, shiftDateSet],
  )
  const monthLabel = `${displayMonth.getFullYear()}年${displayMonth.getMonth() + 1}月`

  useEffect(() => {
    let mounted = true
    queueMicrotask(() => {
      setIsLoadingMenus(true)
      setMenuLoadError("")
    })
    void fetchReservationMenus(shopId)
      .then((menus) => {
        if (!mounted) return
        setMenuOptions(menus)
        setSelectedMenuId((current) => (menus.some((menu) => menu.id === current) ? current : ""))
      })
      .catch(() => {
        if (!mounted) return
        setMenuOptions([])
        setSelectedMenuId("")
        setMenuLoadError("メニューの取得に失敗しました。")
      })
      .finally(() => {
        if (!mounted) return
        setIsLoadingMenus(false)
      })
    return () => {
      mounted = false
    }
  }, [shopId])

  useEffect(() => {
    if (!reservationId) {
      queueMicrotask(() => {
        setCurrentReservationDate("")
        setCurrentReservationTime("")
      })
      return
    }

    if (!currentReservation) return
    queueMicrotask(() => {
      setCurrentReservationDate(currentReservation.date)
      setCurrentReservationTime(currentReservation.time)
      setSelectedDate(currentReservation.date)
      setSelectedTime("")
      setDisplayMonth(new Date(`${currentReservation.date}T00:00:00`))
      setAssignMode(currentReservation.mode === "nomination" ? "nomination" : "omakase")
      setSelectedTrainerId(currentReservation.trainerId ?? "")
      setSelectedMenuId(currentReservation.menuId ?? "")
    })
  }, [reservationId, currentReservation])

  useEffect(() => {
    if (assignMode !== "nomination") {
      queueMicrotask(() => setSelectedTrainerId(""))
    }
  }, [assignMode])

  useEffect(() => {
    let mounted = true
    if (
      assignMode !== "nomination" ||
      !selectedDate ||
      !selectedTime ||
      !selectedMenu?.id ||
      trainers.length === 0
    ) {
      queueMicrotask(() => {
        if (!mounted) return
        setAvailableTrainerIds(null)
        setIsLoadingAvailableTrainers(false)
      })
      return () => {
        mounted = false
      }
    }

    queueMicrotask(() => {
      if (mounted) setIsLoadingAvailableTrainers(true)
    })
    void Promise.all(
      trainers.map(async (trainer) => {
        const slots = await fetchAvailableTimeSlots(
          selectedDate,
          shopId,
          selectedMenu.id,
          trainer.id,
          isUpdateFlow && reservationId ? reservationId : undefined,
        )
        const matched = slots.some((slot) => slot.time === selectedTime && slot.selectable)
        return matched ? trainer.id : null
      }),
    )
      .then((ids) => {
        if (!mounted) return
        setAvailableTrainerIds(new Set(ids.filter((id): id is string => Boolean(id))))
      })
      .catch(() => {
        if (!mounted) return
        setAvailableTrainerIds(new Set())
      })
      .finally(() => {
        if (!mounted) return
        setIsLoadingAvailableTrainers(false)
      })

    return () => {
      mounted = false
    }
  }, [assignMode, selectedDate, selectedTime, selectedMenu?.id, trainers, shopId, isUpdateFlow, reservationId])

  useEffect(() => {
    if (!selectedTrainerId) return
    if (!availableTrainerIds) return
    if (availableTrainerIds.has(selectedTrainerId)) return
    queueMicrotask(() => setSelectedTrainerId(""))
  }, [selectedTrainerId, availableTrainerIds])

  const canProceed = Boolean(
    selectedDate &&
      selectedTime &&
      selectedMenu &&
      assignMode &&
      (assignMode === "omakase" || selectedTrainer),
  )

  function handleDateSelect(dateKey: string) {
    setSelectedDate(dateKey)
    setSelectedTime("")
    setDisplayMonth(new Date(parseDateKey(dateKey).getFullYear(), parseDateKey(dateKey).getMonth(), 1))
  }

  function handleBack() {
    if (window.history.length > 1) {
      navigate(-1)
      return
    }
    navigate(buildPathWithShopId(ROUTES.userHome, shopId))
  }

  return (
    <section className="space-y-5">
      <UserSectionCard title="日時選択">
        <div className="p-3 sm:p-5">
          <div className="mb-4 flex items-center justify-between">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-11 rounded-full"
              onClick={() => setDisplayMonth((prev) => shiftMonth(prev, -1))}
              aria-label="前の月へ移動"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <p className="text-sm font-bold text-foreground">{monthLabel}</p>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-11 rounded-full"
              onClick={() => setDisplayMonth((prev) => shiftMonth(prev, 1))}
              aria-label="次の月へ移動"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>

          <div className="mb-1 grid grid-cols-7">
            {WEEKDAY_LABELS.map((weekday, index) => (
              <p
                key={weekday}
                className={`py-2 text-center text-[11px] font-bold ${
                  index === 0
                    ? "text-red-400"
                    : index === 6
                      ? "text-blue-400"
                      : "text-muted-foreground"
                }`}
              >
                {weekday}
              </p>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day) => {
              const isSelected = selectedDate === day.dateKey
              const isCurrentReservationDate = Boolean(reservationId && currentReservationDate === day.dateKey)
              const isSunday = day.weekday === 0
              const isSaturday = day.weekday === 6

              return (
                <button
                  key={day.dateKey}
                  type="button"
                  disabled={!day.hasAvailability}
                  onClick={() => handleDateSelect(day.dateKey)}
                  className={`relative flex h-11 min-w-0 flex-col items-center justify-center rounded-lg text-sm transition sm:rounded-xl ${
                    isSelected
                      ? "bg-slate-900 font-bold text-white shadow-sm"
                      : isCurrentReservationDate
                        ? "bg-emerald-100 font-semibold text-emerald-700 ring-1 ring-emerald-300"
                        : day.hasAvailability
                          ? `bg-white font-medium hover:bg-slate-100 ${
                              isSunday
                                ? "text-red-500"
                                : isSaturday
                                  ? "text-blue-500"
                                  : "text-foreground"
                            }`
                          : "text-slate-300"
                  } ${!day.isCurrentMonth ? "opacity-30" : ""}`}
                >
                  {day.day}
                  {day.hasAvailability && !isSelected ? (
                    <span className="absolute bottom-1.5 size-1 rounded-full bg-emerald-500" />
                  ) : null}
                </button>
              )
            })}
          </div>

          <p className="mt-3 text-center text-[11px] text-muted-foreground">
            {bookingRules.allowSameDay
              ? `当日予約可（開始${bookingRules.bookingDeadlineMinutes}分前まで） / ${bookingRules.maxAdvanceDays}日先まで受付`
              : `翌日以降（${bookingRules.maxAdvanceDays}日先まで） / 締切: 開始${bookingRules.bookingDeadlineMinutes}分前`}
          </p>
        </div>
      </UserSectionCard>

      <div className="rounded-2xl bg-white shadow-lg">
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-4 sm:px-6">
          <Clock className="size-4 shrink-0 text-muted-foreground" />
          <h3 className="min-w-0 flex-1 text-sm font-bold text-foreground sm:text-base">
            {selectedDate ? `${formatDateShortWithWeekday(selectedDate)} の予約可能な日時` : "日付を選択してください"}
          </h3>
        </div>
        <div className="p-4 sm:p-5">
          {availableTimeSlots.length > 0 ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
              {availableTimeSlots.map((slot) => {
                const isTimeSelected = selectedTime === slot.time
                const isCurrentReservationTime =
                  Boolean(reservationId) &&
                  selectedDate === currentReservationDate &&
                  currentReservationTime === slot.time
                const isDisabled = !slot.selectable && !isCurrentReservationTime
                return (
                  <button
                    key={slot.time}
                    type="button"
                    onClick={() => setSelectedTime(slot.time)}
                    disabled={isDisabled}
                    className={`min-h-11 rounded-xl border px-2 py-3 text-center text-sm font-medium transition sm:px-4 ${
                      isTimeSelected
                        ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                        : isCurrentReservationTime
                          ? "bg-emerald-100 font-semibold text-emerald-700 ring-1 ring-emerald-300"
                          : isDisabled
                            ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                            : "border-slate-200 bg-white text-foreground hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {slot.time}
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center py-8 text-center">
              <CalendarDays className="mb-2 size-8 text-slate-300" />
              <p className="text-sm text-muted-foreground">
                {selectedDate ? "この日の予約可能枠はありません。" : "上のカレンダーから日付を選択してください。"}
              </p>
            </div>
          )}
        </div>
      </div>

      <UserSectionCard title="メニューを選択" headerTone="plain">
        <div className="space-y-3 p-5">
          {menuLoadError ? <p className="text-sm text-destructive">{menuLoadError}</p> : null}
          {isLoadingMenus ? (
            <p className="text-sm text-muted-foreground">メニューを読み込み中です...</p>
          ) : menuOptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">選択できるメニューがありません。</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {menuOptions.map((menu) => {
                const isSelectedMenu = selectedMenuId === menu.id
                return (
                  <button
                    key={menu.id}
                    type="button"
                    onClick={() => setSelectedMenuId(menu.id)}
                    className={`rounded-xl border px-4 py-3 text-left text-sm transition ${
                      isSelectedMenu
                        ? "border-black ring-2 ring-slate-500"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <p className="font-semibold text-foreground">{menu.name}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      <span className="font-semibold tabular-nums text-foreground">
                        ¥{menu.price.toLocaleString()}
                      </span>
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Clock className="size-3.5 shrink-0" aria-hidden />
                        <span>所要時間 {menu.durationMinutes}分</span>
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </UserSectionCard>

      <UserSectionCard title="予約方法を選択" headerTone="plain">
        <div className="grid gap-3 p-5 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setAssignMode("omakase")}
            className={`rounded-xl border px-4 py-4 text-left text-sm transition ${
              assignMode === "omakase"
                ? "border-black ring-2 ring-slate-500 bg-white"
                : "border-slate-200 bg-white hover:bg-slate-50"
            }`}
          >
            <p className="font-semibold text-foreground">おまかせ</p>
            <p className="mt-1 text-xs text-muted-foreground">担当スタッフを指定しない</p>
          </button>
          <button
            type="button"
            onClick={() => setAssignMode("nomination")}
            className={`rounded-xl border px-4 py-4 text-left text-sm transition ${
              assignMode === "nomination"
                ? "border-black ring-2 ring-slate-500 bg-white"
                : "border-slate-200 bg-white hover:bg-slate-50"
            }`}
          >
            <p className="font-semibold text-foreground">指名</p>
            <p className="mt-1 text-xs text-muted-foreground">担当スタッフを選択する</p>
          </button>
        </div>
      </UserSectionCard>

      {assignMode === "nomination" ? (
        <UserSectionCard title="担当スタッフを選択" headerTone="plain">
          <div className="grid gap-4 p-5 md:grid-cols-2 lg:grid-cols-3">
            {!selectedDate || !selectedTime ? (
              <p className="col-span-full text-sm text-muted-foreground">
                先に日時を選択してください。
              </p>
            ) : !selectedMenu ? (
              <p className="col-span-full text-sm text-muted-foreground">
                先にメニューを選択してください。
              </p>
            ) : isLoadingAvailableTrainers ? (
              <p className="col-span-full text-sm text-muted-foreground">
                選択日時で予約可能なスタッフを確認中です...
              </p>
            ) : visibleTrainers.length === 0 ? (
              <p className="col-span-full text-sm text-muted-foreground">
                選択した日時にシフト登録しているスタッフがいません。
              </p>
            ) : (
              visibleTrainers.map((trainer) => {
                const isSelected = selectedTrainerId === trainer.id
                return (
                  <button
                    key={trainer.id}
                    type="button"
                    onClick={() => setSelectedTrainerId(trainer.id)}
                    className={`group relative overflow-hidden rounded-2xl border transition hover:-translate-y-1 hover:shadow-lg ${
                      isSelected ? "border-black ring-2 ring-slate-500 bg-white" : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="flex flex-col items-center px-5 pb-4 pt-6">
                      <div className="relative mb-3">
                        <div className="flex size-20 items-center justify-center rounded-full border-2 border-slate-100 bg-slate-100 shadow-sm">
                          <UserRound className="size-9 text-slate-400" />
                        </div>
                      </div>
                      <p className="text-base font-bold text-foreground">{trainer.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{trainer.specialty}</p>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </UserSectionCard>
      ) : null}

      {canProceed ? (
        <Button
          type="button"
          size="lg"
          className="w-full rounded-xl text-base"
          onClick={() =>
            navigate(
              buildPathWithShopId(
                isUpdateFlow ? ROUTES.userReservationConfirm : ROUTES.userReservationInput,
                shopId,
              ),
              {
                state: {
                  mode: assignMode,
                  date: selectedDate,
                  time: selectedTime,
                  trainerId: assignMode === "nomination" ? selectedTrainer?.id || "" : "",
                  trainerName: assignMode === "nomination" ? selectedTrainer?.name || "" : "",
                  preferredMenuId: selectedMenu?.id,
                  preferredMenuName: selectedMenu?.name,
                  returnSearch: returnSearch || undefined,
                  ...(isUpdateFlow && reservationId ? { reservationId } : {}),
                  isUpdatingExistingReservation: isUpdateFlow,
                },
              },
            )
          }
        >
          {isUpdateFlow ? "変更内容確認へ進む" : "予約者情報入力へ進む"}
          <ArrowRight className="ml-1 size-4" />
        </Button>
      ) : null}
      <Button type="button" variant="outline" size="lg" className="w-full rounded-xl" onClick={handleBack}>
        前の画面へ戻る
      </Button>
    </section>
  )
}
