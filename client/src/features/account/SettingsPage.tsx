import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { changePassword } from "../../api/auth";
import { extractErrorMessage } from "../../api/client";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { ErrorState } from "../../components/Feedback";
import { FieldError } from "../../components/FieldError";
import { Input } from "../../components/Input";
import { useAuth } from "../../hooks/useAuth";
import { changePasswordSchema, type ChangePasswordFormValues } from "../../lib/authSchemas";

export function SettingsPage() {
  const { user } = useAuth();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    mode: "onTouched",
    defaultValues: { currentPassword: "", newPassword: "", confirmNewPassword: "" },
  });

  const mutation = useMutation({
    mutationFn: (values: ChangePasswordFormValues) =>
      changePassword(values.currentPassword, values.newPassword),
    onSuccess: () => {
      toast.success("Password updated.");
      reset();
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink-900">Account settings</h1>
      <p className="mt-1 text-sm text-ink-500">Manage your profile and security.</p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:max-w-xl">
        <Card className="p-6">
          <h2 className="text-sm font-medium text-ink-700">Profile</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-400">Name</dt>
              <dd className="font-medium text-ink-900">{user?.name}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-400">Email</dt>
              <dd className="font-medium text-ink-900">{user?.email}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-400">Role</dt>
              <dd className="font-medium text-ink-900">{user?.role}</dd>
            </div>
          </dl>
        </Card>

        <Card className="p-6">
          <h2 className="text-sm font-medium text-ink-700">Change password</h2>
          <p className="mt-1 text-xs text-ink-400">Choose a strong password you don't use elsewhere.</p>

          <form
            className="mt-4 space-y-4"
            onSubmit={handleSubmit((values) => mutation.mutate(values))}
            noValidate
          >
            <div>
              <label htmlFor="settings-current-password" className="text-sm font-medium text-ink-700">
                Current password
              </label>
              <Input
                id="settings-current-password"
                type="password"
                invalid={Boolean(errors.currentPassword)}
                aria-describedby={errors.currentPassword ? "settings-current-password-error" : undefined}
                {...register("currentPassword")}
              />
              <FieldError id="settings-current-password-error" message={errors.currentPassword?.message} />
            </div>
            <div>
              <label htmlFor="settings-new-password" className="text-sm font-medium text-ink-700">
                New password
              </label>
              <Input
                id="settings-new-password"
                type="password"
                invalid={Boolean(errors.newPassword)}
                aria-describedby={errors.newPassword ? "settings-new-password-error" : undefined}
                {...register("newPassword")}
              />
              <FieldError id="settings-new-password-error" message={errors.newPassword?.message} />
            </div>
            <div>
              <label htmlFor="settings-confirm-new-password" className="text-sm font-medium text-ink-700">
                Confirm new password
              </label>
              <Input
                id="settings-confirm-new-password"
                type="password"
                invalid={Boolean(errors.confirmNewPassword)}
                aria-describedby={errors.confirmNewPassword ? "settings-confirm-new-password-error" : undefined}
                {...register("confirmNewPassword")}
              />
              <FieldError id="settings-confirm-new-password-error" message={errors.confirmNewPassword?.message} />
            </div>

            {mutation.isError && <ErrorState message={extractErrorMessage(mutation.error)} />}

            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Updating…" : "Update password"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
