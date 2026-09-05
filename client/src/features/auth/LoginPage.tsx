import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { fetchMe, login } from "../../api/auth";
import { extractErrorMessage } from "../../api/client";
import { Button } from "../../components/Button";
import { ErrorState } from "../../components/Feedback";
import { FieldError } from "../../components/FieldError";
import { Input } from "../../components/Input";
import { Logo } from "../../components/Logo";
import { roleHome } from "../../routes/guards";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { loginSchema, type LoginFormValues } from "../../lib/authSchemas";
import type { Me } from "../../api/types";

export function LoginPage() {
  useDocumentTitle("Connexion");
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: "onTouched",
    defaultValues: { email: "", password: "" },
  });

  const mutation = useMutation({
    mutationFn: (values: LoginFormValues) => login(values.email, values.password),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      const me = await queryClient.fetchQuery<Me>({ queryKey: ["me"], queryFn: fetchMe });
      navigate(roleHome(me));
    },
  });

  return (
    <div className="flex min-h-svh">
      <div className="flex w-full flex-col justify-center px-6 py-12 sm:px-12 lg:w-1/2 lg:px-20">
        <div className="mx-auto w-full max-w-sm">
          <Logo className="h-10 w-10" />
          <h1 className="mt-6 text-2xl font-bold text-ink-900">Connexion à EduManage</h1>
          <p className="mt-1 text-sm text-ink-500">Enseignants et élèves, réunis au même endroit.</p>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate>
            <div>
              <label htmlFor="login-email" className="text-sm font-medium text-ink-700">
                E-mail <span className="text-danger-600" aria-hidden="true">*</span>
              </label>
              <Input
                id="login-email"
                type="email"
                required
                aria-required="true"
                invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? "login-email-error" : undefined}
                {...register("email")}
              />
              <FieldError id="login-email-error" message={errors.email?.message} />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="login-password" className="text-sm font-medium text-ink-700">
                  Mot de passe <span className="text-danger-600" aria-hidden="true">*</span>
                </label>
                <Link
                  to="/forgot-password"
                  className="focus-ring rounded-sm text-xs font-medium text-accent-600 hover:text-accent-700"
                >
                  Mot de passe oublié ?
                </Link>
              </div>
              <Input
                id="login-password"
                type="password"
                required
                aria-required="true"
                invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? "login-password-error" : undefined}
                {...register("password")}
              />
              <FieldError id="login-password-error" message={errors.password?.message} />
            </div>

            {mutation.isError && <ErrorState message={extractErrorMessage(mutation.error)} />}

            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending ? "Connexion…" : "Se connecter"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-500">
            Vous n'avez pas de compte ?{" "}
            <Link to="/register" className="focus-ring rounded-sm font-medium text-accent-600 hover:text-accent-700">
              S'inscrire
            </Link>
          </p>
        </div>
      </div>
      <div className="hidden bg-navy lg:block lg:w-1/2" aria-hidden="true" />
    </div>
  );
}
