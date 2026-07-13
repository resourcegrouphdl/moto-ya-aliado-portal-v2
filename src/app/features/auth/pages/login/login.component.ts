import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { AlertComponent } from '../../../../shared/ui/alert/alert.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { IconComponent } from '../../../../shared/ui/icon/icon.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';

const ERROR_MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'Correo o contraseña incorrectos.',
  'auth/wrong-password': 'Correo o contraseña incorrectos.',
  'auth/user-not-found': 'Correo o contraseña incorrectos.',
  'auth/invalid-email': 'El correo ingresado no es válido.',
  'auth/user-disabled': 'Este usuario está deshabilitado.',
  'auth/too-many-requests': 'Demasiados intentos. Intenta de nuevo más tarde.'
};

@Component({
  selector: 'mt-login-page',
  standalone: true,
  imports: [ReactiveFormsModule, AlertComponent, ButtonComponent, IconComponent, InputComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  protected loading = signal(false);
  protected errorMessage = signal<string | null>(null);

  protected readonly emailError = computed(() =>
    this.form.controls.email.invalid && this.form.controls.email.touched ? 'Ingresa un correo válido.' : undefined
  );
  protected readonly passwordError = computed(() =>
    this.form.controls.password.invalid && this.form.controls.password.touched ? 'Mínimo 6 caracteres.' : undefined
  );

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);
    const { email, password } = this.form.getRawValue();

    this.authService.login(email, password).subscribe({
      next: () => this.router.navigateByUrl('/'),
      error: (err: unknown) => {
        this.loading.set(false);
        const code = typeof err === 'object' && err !== null && 'code' in err ? String((err as { code: unknown }).code) : '';
        this.errorMessage.set(ERROR_MESSAGES[code] ?? 'No se pudo iniciar sesión. Intenta nuevamente.');
      }
    });
  }
}
