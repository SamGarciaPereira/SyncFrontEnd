import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { UserPlus } from "lucide-react";
import { Button } from "../components/Button";
import { FieldLabel } from "../components/FieldLabel";
import { PasswordField } from "../components/PasswordField";
import { TextField } from "../components/TextField";
import { AuthLayout } from "../layout/AuthLayout";
import { useAuth } from "../auth/authContext";
import { getApiErrorMessage } from "../../services/errors";

const MIN_PASSWORD_LENGTH = 6; // same rule as the API
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const onlyDigits = (value: string) => value.replace(/\D/g, "");

/** Máscara enquanto digita: (41) 99999-8888 */
function formatPhone(value: string): string {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function isValidPhone(value: string): boolean {
  const d = onlyDigits(value);
  return /^[1-9]{2}/.test(d) && (d.length === 10 || (d.length === 11 && d[2] === "9"));
}

/** Today as "AAAA-MM-DD" in the local timezone (limit for the birth date). */
function today(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function Cadastro() {
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const validate = (): string | null => {
    if (!name.trim()) return "Informe o seu nome.";
    if (!birthDate) return "Informe a sua data de nascimento.";
    if (birthDate > today() || birthDate < "1900-01-01") {
      return "Confira a data de nascimento.";
    }
    if (!EMAIL_REGEX.test(email.trim())) return "Informe um e-mail válido (ex.: maria@email.com).";
    if (!isValidPhone(phone)) return "Informe um telefone válido com DDD (ex.: (41) 99999-8888).";
    if (password.length < MIN_PASSWORD_LENGTH) {
      return `A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;
    }
    if (password !== confirmPassword) return "As senhas não são iguais.";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validate();
    setError(problem);
    if (problem) return;

    setSubmitting(true);
    try {
      // Creates the account and logs in right away
      await signUp({ name: name.trim(), email: email.trim(), password, birthDate, phone: onlyDigits(phone)});
      navigate("/app", { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err));
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Criar conta"
      subtitle="Leva menos de um minuto."
      footer={
        <>
          Já tem cadastro?{" "}
          <Link
            to="/entrar"
            className="font-semibold text-forest underline underline-offset-4 hover:text-forest-strong"
          >
            Entre aqui
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div>
          <FieldLabel htmlFor="signup-name">Nome</FieldLabel>
          <TextField
            id="signup-name"
            autoComplete="name"
            placeholder="Como você se chama?"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div>
          <FieldLabel htmlFor="signup-birth">Data de nascimento</FieldLabel>
          <TextField
            id="signup-birth"
            type="date"
            autoComplete="bday"
            min="1900-01-01"
            max={today()}
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
          />
        </div>

        <div>
          <FieldLabel htmlFor="signup-phone">Telefone (WhatsApp)</FieldLabel>
          <TextField
            id="signup-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="(41) 99999-8888"
            aria-describedby="signup-phone-hint"
            value={phone}
            onChange={(e) => setPhone(formatPhone(e.target.value))}
          />
          <p id="signup-phone-hint" className="mt-1.5 text-sm text-muted">
            Usado para avisos no WhatsApp e contato de emergência.
          </p>
        </div>

        <div>
          <FieldLabel htmlFor="signup-email">E-mail</FieldLabel>
          <TextField
            id="signup-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="seuemail@exemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div>
          <FieldLabel htmlFor="signup-password">Senha</FieldLabel>
          <PasswordField
            id="signup-password"
            autoComplete="new-password"
            aria-describedby="signup-password-hint"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p id="signup-password-hint" className="mt-1.5 text-sm text-muted">
            Mínimo de {MIN_PASSWORD_LENGTH} caracteres.
          </p>
        </div>

        <div>
          <FieldLabel htmlFor="signup-password-confirm">Confirme a senha</FieldLabel>
          <PasswordField
            id="signup-password-confirm"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}

        <Button
          type="submit"
          size="lg"
          fullWidth
          disabled={submitting}
          leftIcon={<UserPlus size={20} />}
        >
          {submitting ? "Criando conta..." : "Criar conta"}
        </Button>
      </form>
    </AuthLayout>
  );
}
