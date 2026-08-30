import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { resetPassword } from "../../api/auth";
import { extractErrorMessage } from "../../api/client";
import { Button } from "../../components/Button";
import { ErrorState } from "../../components/Feedback";
import { FieldError } from "../../components/FieldError";
import { Input } from "../../components/Input";
import { Logo } from "../../components/Logo";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { resetPasswordSchema, type ResetPasswordFormValues } from "../../lib/authSchemas";

export function ResetPasswordPage() {
  useDocumentTitle("Set a new password");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    mode: "onTouched",
    defaultValues: { password: "", confirmPassword: "" },
  });

  const mutation = useMutation({
    mutationFn: (values: ResetPasswordFormValues) => resetPassword(token, values.password),
    onSuccess: () => {
      navigate("/login", { replace: true });
    },
  });

  if (!token) {
    return (
      <div className="flex min-h-svh">
        <div className="flex w-full flex-col justify-center px-6 py-12 sm:px-12 lg:w-1/2 lg:px-20">
          <div className="mx-auto w-full max-w-sm text-center">
            <Logo className="mx-auto h-10 w-10" />
            <h1 className="mt-6 text-2xl font-bold text-danger-600">Invalid reset link</h1>
            <p className="mt-2 text-sm text-ink-500">This password reset link is missing its token.</p>
            <Link
              to="/forgot-password"
              className="focus-ring mt-6 block rounded-sm text-sm font-medium text-accent-600 hover:text-accent-700"
            >
              Request a new link
            </Link>
          </div>
        </div>
        <div className="hidden bg-navy lg:block lg:w-1/2" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="flex min-h-svh">
      <div className="flex w-full flex-col justify-center px-6 py-12 sm:px-12 lg:w-1/2 lg:px-20">
        <div className="mx-auto w-full max-w-sm">
          <Logo className="h-10 w-10" />
          <h1 className="mt-6 text-2xl font-bold text-ink-900">Set a new password</h1>
          <p className="mt-1 text-sm text-ink-500">Choose a new password for your account.</p>

          <form className="mt-5 space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate>
            <div>
              <label htmlFor="reset-password" className="text-sm font-medium text-ink-700">
                New password <span className="text-danger-600" aria-hidden="true">*</span>
              </label>
              <Input
                id="reset-password"
                type="password"
                required
                aria-required="true"
                invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? "reset-password-error" : undefined}
                {...register("password")}
              />
              <FieldError id="reset-password-error" message={errors.password?.message} />
            </div>
            <div>
              <label htmlFor="reset-confirm-password" className="text-sm font-medium text-ink-700">
                Confirm new password <span className="text-danger-600" aria-hidden="true">*</span>
              </label>
              <Input
                id="reset-confirm-password"
                type="password"
                required
                aria-required="true"
                invalid={Boolean(errors.confirmPassword)}
                aria-describedby={errors.confirmPassword ? "reset-confirm-password-error" : undefined}
                {...register("confirmPassword")}
              />
              <FieldError id="reset-confirm-password-error" message={errors.confirmPassword?.message} />
            </div>

            {mutation.isError && <ErrorState message={extractErrorMessage(mutation.error)} />}

            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending ? "Resetting…" : "Reset password"}
            </Button>
          </form>
        </div>
      </div>
      <div className="hidden bg-navy lg:block lg:w-1/2" aria-hidden="true" />
    </div>
  );
}
