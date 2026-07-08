import { useEffect, useMemo, useState } from "react"
import { Clock, UserRound } from "lucide-react"
import { useLocation, useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { ROUTES } from "@/constants/routes"
import {
  fetchAvailableTimeSlots,
  fetchReservationMenus,
  type ReservationMenuOption,
} from "@/features/user/api/userReservationApi"
import { UserSectionCard } from "@/features/user/components/UserSectionCard"
import { usePersistentReservationId } from "@/features/user/hooks/usePersistentReservationId"
import { buildPathWithShopId, useShopId } from "@/features/user/hooks/useShopId"
import { useUserReservation } from "@/features/user/hooks/useUserReservation"
import { useUserTrainers } from "@/features/user/hooks/useUserTrainers"

export function UserNominationPage() {
  const shopId = useShopId()
  const navigate = useNavigate()
  const location = useLocation()
  const routeState = (location.state as {
    isUpdatingExistingReservation?: boolean
    date?: string
    time?: string
    reservationId?: string
    returnSearch?: string
  } | null) ?? null
  const isUpdateFlow = routeState?.isUpdatingExistingReservation === true
  const selectedDate = (routeState?.date ?? "").trim()
  const selectedTime = (routeState?.time ?? "").trim()
  const returnSearch = routeState?.returnSearch ?? ""
  const persistentReservationId = usePersistentReservationId()
  const stateReservationId = (routeState?.reservationId ?? "").trim()
  const reservationId = isUpdateFlow ? stateReservationId || persistentReservationId : ""
  const { trainers } = useUserTrainers(shopId)
  const { reservation } = useUserReservation(reservationId, shopId)
  const [selectedTrainerId, setSelectedTrainerId] = useState("")
  const [menuOptions, setMenuOptions] = useState<ReservationMenuOption[]>([])
  const [selectedMenuId, setSelectedMenuId] = useState("")
  const [isLoadingMenus, setIsLoadingMenus] = useState(false)
  const [menuLoadError, setMenuLoadError] = useState("")
  const [assignMode, setAssignMode] = useState<"nomination" | "omakase" | "">("")
  const [availableTrainerIds, setAvailableTrainerIds] = useState<Set<string> | null>(null)
  const [isLoadingAvailableTrainers, setIsLoadingAvailableTrainers] = useState(false)
  const currentTrainerId = useMemo(
    () => (reservation?.mode === "nomination" ? (reservation.trainerId ?? "") : ""),
    [reservation],
  )
  const selectedTrainer = useMemo(
    () => trainers.find((trainer) => trainer.id === selectedTrainerId),
    [selectedTrainerId, trainers],
  )
  const selectedMenu = useMemo(
    () => menuOptions.find((menu) => menu.id === selectedMenuId),
    [menuOptions, selectedMenuId],
  )
  const visibleTrainers = useMemo(() => {
    const sorted = trainers.slice().sort((a, b) => b.rating - a.rating)
    if (!availableTrainerIds) return sorted
    return sorted.filter((trainer) => availableTrainerIds.has(trainer.id))
  }, [trainers, availableTrainerIds])

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

  function handleBack() {
    if (window.history.length > 1) {
      navigate(-1)
      return
    }
    navigate(buildPathWithShopId(ROUTES.userHome, shopId))
  }

  return (
    <section className="space-y-5">
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
            onClick={() => {
              setAssignMode("omakase")
              setSelectedTrainerId("")
            }}
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
            {!selectedMenu ? (
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
                const isCurrentTrainer = trainer.id === currentTrainerId
                const isSelected = selectedTrainerId === trainer.id
                return (
                  <button
                    key={trainer.id}
                    type="button"
                    onClick={() => setSelectedTrainerId(trainer.id)}
                    className={`group relative overflow-hidden rounded-2xl border transition hover:-translate-y-1 hover:shadow-lg ${
                      isSelected
                        ? "border-black ring-2 ring-slate-500 bg-white"
                        : isCurrentTrainer
                          ? "border-emerald-400 ring-2 ring-emerald-100"
                          : "border-slate-200 bg-white"
                    }`}
                  >
                    {isCurrentTrainer ? (
                      <div className="absolute left-3 top-3 z-10 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white shadow">
                        変更前トレーナー
                      </div>
                    ) : null}
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
      <Button
        type="button"
        size="lg"
        className="w-full rounded-xl"
        disabled={
          !selectedMenu ||
          !assignMode ||
          (assignMode === "nomination" && !selectedTrainer) ||
          !selectedDate ||
          !selectedTime
        }
        onClick={() => {
          if (!selectedMenu || !assignMode || !selectedDate || !selectedTime) return
          const isNomination = assignMode === "nomination"
          if (isNomination && !selectedTrainer) return
          const nominatedTrainerId = isNomination && selectedTrainer ? selectedTrainer.id : ""
          const nominatedTrainerName = isNomination && selectedTrainer ? selectedTrainer.name : ""
          navigate(buildPathWithShopId(ROUTES.userReservationInput, shopId), {
            state: {
              mode: isNomination ? "nomination" : "omakase",
              date: selectedDate,
              time: selectedTime,
              trainerId: nominatedTrainerId,
              trainerName: nominatedTrainerName,
              preferredMenuId: selectedMenu.id,
              preferredMenuName: selectedMenu.name,
              ...(returnSearch ? { returnSearch } : {}),
              ...(reservationId ? { reservationId } : {}),
              isUpdatingExistingReservation: isUpdateFlow,
            },
          })
        }}
      >
        予約情報入力へ進む
      </Button>
      <Button type="button" variant="outline" size="lg" className="w-full rounded-xl" onClick={handleBack}>
        前の画面へ戻る
      </Button>
    </section>
  )
}
