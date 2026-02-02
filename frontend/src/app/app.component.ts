import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from './api.service';

type ToastType = 'success' | 'error' | 'info';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  numeroControl = '';
  password = '';

  loading = false;

  toastVisible = false;
  toastMessage = '';
  toastType: ToastType = 'info';

  constructor(private api: ApiService) {}

  private showToast(message: string, type: ToastType = 'info', duration = 2600) {
    this.toastMessage = message;
    this.toastType = type;
    this.toastVisible = true;

    window.setTimeout(() => {
      this.toastVisible = false;
      this.toastMessage = '';
    }, duration);
  }

  onSubmit() {
    const nc = (this.numeroControl || '').trim();
    const pw = (this.password || '').trim();

    if (!nc || !pw) {
      this.showToast('⚠️ Por favor, completa todos los campos.', 'info');
      return;
    }

    this.loading = true;

    this.api.login(nc, pw).subscribe({
      next: (res) => {
        this.loading = false;

        if (res?.success) {
          this.showToast(res.message || '✅ Bienvenido', 'success');

          const user = {
            nombreCompleto: res.nombre || '',
            numeroControl: res.numeroControl || nc,
            rol: (res.rol || '').toLowerCase()
          };

          try {
            localStorage.setItem('LE_user', JSON.stringify(user));
          } catch {}

          // ✅ Redirección a legacy (HTML) ya que tu proyecto los tiene en legacy_public
         setTimeout(() => {
  if (user.rol === 'auxiliar') {
    window.location.href = '/public/Auxiliar/auxiliar.html';
  } else {
    window.location.href = '/public/Alumnos/alumnos-inicial.html';
  }
}, 450);


        } else {
          this.showToast(res?.message || '❌ Credenciales incorrectas', 'error');
        }
      },
      error: (err) => {
        console.error(err);
        this.loading = false;
        this.showToast('❌ No se pudo conectar con el servidor.', 'error', 3500);
      }
    });
  }
}
