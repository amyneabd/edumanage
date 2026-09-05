import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../hooks/useAuth";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { logout } from "../../api/auth";
import { Button } from "../../components/Button";
import { Logo } from "../../components/Logo";

export function PendingPage() {
  useDocumentTitle("En attente d'approbation");
  const { user, refetch } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me"] });
      navigate("/login");
    },
  });

  useEffect(() => {
    if (user?.status === "ACTIVE") {
      navigate(user.role === "TEACHER" ? "/teacher/overview" : "/pupil/home");
    }
  }, [user, navigate]);

  useEffect(() => {
    const interval = setInterval(() => refetch(), 8000);
    return () => clearInterval(interval);
  }, [refetch]);

  const rejected = user?.status === "REJECTED";

  return (
    <div className="flex min-h-svh">
      <div className="flex w-full flex-col justify-center px-6 py-12 sm:px-12 lg:w-1/2 lg:px-20">
        <div className="mx-auto w-full max-w-sm text-center">
          <Logo className="mx-auto h-10 w-10" />
          {rejected ? (
            <>
              <h1 className="mt-6 text-2xl font-bold text-danger-600">Demande non approuvée</h1>
              <p className="mt-2 text-sm text-ink-500">
                Votre demande de compte a été refusée. Veuillez contacter
                {user?.role === "TEACHER" ? " l'administrateur du site" : " votre enseignant"} pour plus de détails.
              </p>
            </>
          ) : (
            <>
              <h1 className="mt-6 text-2xl font-bold text-ink-900">En attente d'approbation</h1>
              <p className="mt-2 text-sm text-ink-500">
                {user?.role === "TEACHER"
                  ? "Un administrateur doit approuver votre compte enseignant avant que vous puissiez vous connecter."
                  : "Votre enseignant doit accepter votre demande et vous affecter à une classe."}
              </p>
            </>
          )}
          <Button variant="secondary" className="mt-6" onClick={() => logoutMutation.mutate()}>
            Se déconnecter
          </Button>
        </div>
      </div>
      <div className="hidden bg-navy lg:block lg:w-1/2" aria-hidden="true" />
    </div>
  );
}
