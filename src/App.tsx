import { BadgeAlert, Dumbbell, ShieldCheck, UserRound } from "lucide-react"
import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ROUTES } from "@/constants/routes"
import {
  BackofficeInitialSetupPage,
  BackofficeLoginPage,
  BackofficeSetupBusinessHoursPage,
  BackofficeSetupBookingRulesPage,
  BackofficeSetupDonePage,
  BackofficeSignupPage,
  BackofficeSignupVerifyPage,
  BackofficeSignupVerifySentPage,
  CustomerLoginPage,
  CustomerSignupPage,
} from "@/features/auth/pages"
import { AdminCalendarPage } from "@/features/admin/pages/AdminCalendarPage"
import { AdminDashboardPage } from "@/features/admin/pages/AdminDashboardPage"
import { AdminNewReservationConfirmPage } from "@/features/admin/pages/AdminNewReservationConfirmPage"
import { AdminNewReservationPage } from "@/features/admin/pages/AdminNewReservationPage"
import { AdminReservationDetailPage } from "@/features/admin/pages/AdminReservationDetailPage"
import { AdminShiftCalendarPage } from "@/features/admin/pages/AdminShiftCalendarPage"
import { AdminMenusPage } from "@/features/admin/pages/AdminMenusPage"
import { AdminPaymentsPage } from "@/features/admin/pages/AdminPaymentsPage"
import { AdminSalonSettingsPage } from "@/features/admin/pages/AdminSalonSettingsPage"
import { AdminSalonProfilePage } from "@/features/admin/pages/AdminSalonProfilePage"
import { AdminStaffPage } from "@/features/admin/pages/AdminStaffPage"
import { UserDashboardPage } from "@/features/user/pages/UserDashboardPage"
import { UserNominationPage } from "@/features/user/pages/UserNominationPage"
import { UserReservationDetailPage } from "@/features/user/pages/UserReservationDetailPage"
import { UserReservationLookupPage } from "@/features/user/pages/UserReservationLookupPage"
import { SalonPublicEntryPage } from "@/features/user/pages/SalonPublicEntryPage"
import { UserReservationConfirmPage } from "@/features/user/pages/UserReservationConfirmPage"
import { UserReservationChangeModePage } from "@/features/user/pages/UserReservationChangeModePage"
import { UserReservationInputPage } from "@/features/user/pages/UserReservationInputPage"
import { UserPayPayReturnPage } from "@/features/user/pages/UserPayPayReturnPage"
import { UserSchedulePage } from "@/features/user/pages/UserSchedulePage"
import { AdminLayout } from "./layouts/AdminLayout"
import { OwnerOnlyRoute } from "./layouts/OwnerOnlyRoute"
import { UserLayout } from "./layouts/UserLayout"

function LandingPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col justify-center px-4 py-12 sm:px-6">
      <div className="mb-8 flex items-center gap-3">
        <div className="rounded-lg border border-border bg-card p-2">
          <Dumbbell className="size-5 text-foreground" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">予約管理SaaS</p>
          <h1 className="text-2xl font-semibold tracking-tight">Effortless is Stylish</h1>
        </div>
      </div>

      <div className="mb-6 flex items-center gap-2 rounded-lg bg-muted px-4 py-3">
        <BadgeAlert className="size-5 shrink-0" />
        <p className="text-xl font-bold tracking-tight">フロントエンド完結モックです。</p>
      </div>

      <div className="mb-6 space-y-2 rounded-lg border border-dashed border-border bg-muted/40 p-4 text-sm">
        <p className="font-medium">サインイン用のサンプルアカウント</p>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          <li>管理者（オーナー）: <code>admin@example.com</code> / <code>admin123</code></li>
          <li>管理者（スタッフ）: <code>staff@example.com</code> / <code>staff123</code></li>
          <li>予約者: <code>customer@example.com</code> / <code>customer123</code></li>
        </ul>
        <p className="pt-1 text-xs text-muted-foreground">
          データは <code>localStorage</code> に保持されます。リセットしたい場合はブラウザのストレージから
          <code>saas_frontend_mock_state_v1</code> を削除してください。ワンタイムコード（予約照会等）は
          <code>000000</code> を入力してください。
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="rounded-lg shadow-xs">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <UserRound className="size-4" />
              予約者用
            </CardTitle>
            <CardDescription>予約者向けサロンページに遷移します</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">

            <Button asChild className="w-full rounded-md">
              <Link to="/s/sample-salon-2026">予約ページへ</Link>
            </Button>
            <Button asChild variant="outline" className="w-full rounded-md">
              <Link to="/customer/signup?shopId=sample-salon-2026">予約者新規登録へ</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-lg shadow-xs">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck className="size-4" />
              管理者・スタッフ用
            </CardTitle>
            <CardDescription>管理者・スタッフ向け認証ページに遷移します</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button asChild className="w-full rounded-md">
              <Link to={ROUTES.backofficeLogin}>管理者・スタッフログインへ</Link>
            </Button>
            <Button asChild variant="outline" className="w-full rounded-md">
              <Link to={ROUTES.backofficeSignup}>管理者・スタッフ新規登録へ</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path={ROUTES.landing} element={<LandingPage />} />

        <Route path={ROUTES.customerLogin} element={<CustomerLoginPage />} />
        <Route path={ROUTES.customerSignup} element={<CustomerSignupPage />} />
        <Route path={ROUTES.backofficeLogin} element={<BackofficeLoginPage />} />
        <Route path={ROUTES.backofficeSignup} element={<BackofficeSignupPage />} />
        <Route path={ROUTES.salonPublic} element={<SalonPublicEntryPage />} />
        <Route
          path={ROUTES.backofficeSignupVerifySent}
          element={<BackofficeSignupVerifySentPage />}
        />
        <Route
          path={ROUTES.backofficeSignupVerify}
          element={<BackofficeSignupVerifyPage />}
        />
        <Route
          path={ROUTES.backofficeInitialSetup}
          element={<BackofficeInitialSetupPage />}
        />
        <Route
          path={ROUTES.backofficeSetupDone}
          element={<BackofficeSetupDonePage />}
        />
        <Route element={<UserLayout />}>
          <Route path={ROUTES.userHome} element={<UserDashboardPage />} />
          <Route path={ROUTES.userReservationLookup} element={<UserReservationLookupPage />} />
          <Route path={ROUTES.userReservationList} element={<UserReservationLookupPage />} />
          <Route path={ROUTES.userReservationDetail} element={<UserReservationDetailPage />} />
          <Route path={ROUTES.userReservationNomination} element={<UserNominationPage />} />
          <Route path={ROUTES.userReservationChangeMode} element={<UserReservationChangeModePage />} />
          <Route path={ROUTES.userReservationSchedule} element={<UserSchedulePage />} />
          <Route path={ROUTES.userReservationInput} element={<UserReservationInputPage />} />
          <Route path={ROUTES.userReservationConfirm} element={<UserReservationConfirmPage />} />
          <Route path={ROUTES.userReservationPaypayReturn} element={<UserPayPayReturnPage />} />
        </Route>

        <Route element={<AdminLayout />}>
          <Route path={ROUTES.adminHome} element={<AdminDashboardPage />} />
          <Route path={ROUTES.adminCalendar} element={<AdminCalendarPage />} />
          <Route path={ROUTES.adminShiftCalendar} element={<AdminShiftCalendarPage />} />
          <Route
            path={ROUTES.backofficeSetupBusinessHours}
            element={<BackofficeSetupBusinessHoursPage />}
          />
          <Route
            path={ROUTES.backofficeSetupBookingRules}
            element={<BackofficeSetupBookingRulesPage />}
          />
          <Route
            path={ROUTES.adminCancelled}
            element={<Navigate to={ROUTES.adminHome} replace />}
          />
          <Route
            path={ROUTES.adminStaff}
            element={
              <OwnerOnlyRoute>
                <AdminStaffPage />
              </OwnerOnlyRoute>
            }
          />
          <Route
            path={ROUTES.adminMenus}
            element={
              <OwnerOnlyRoute>
                <AdminMenusPage />
              </OwnerOnlyRoute>
            }
          />
          <Route
            path={ROUTES.adminPayments}
            element={
              <OwnerOnlyRoute>
                <AdminPaymentsPage />
              </OwnerOnlyRoute>
            }
          />
          <Route
            path={ROUTES.adminSalonSettings}
            element={
              <OwnerOnlyRoute>
                <AdminSalonSettingsPage />
              </OwnerOnlyRoute>
            }
          />
          <Route
            path={ROUTES.adminSalonProfile}
            element={
              <OwnerOnlyRoute>
                <AdminSalonProfilePage />
              </OwnerOnlyRoute>
            }
          />
          <Route
            path={ROUTES.adminNewReservationConfirm}
            element={<AdminNewReservationConfirmPage />}
          />
          <Route path={ROUTES.adminNewReservation} element={<AdminNewReservationPage />} />
          <Route
            path={ROUTES.adminReservationDetail}
            element={<AdminReservationDetailPage />}
          />
        </Route>

        <Route path="*" element={<Navigate to={ROUTES.landing} replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
