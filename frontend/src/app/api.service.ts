import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface LoginResponse {
  success: boolean;
  message: string;
  rol?: string;
  nombre?: string;
  numeroControl?: string;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  // OJO: si estás usando NGINX con proxy, lo ideal es usar ruta relativa:
  // private baseUrl = '/api';
  // Si NO tienes proxy, usa el host directo:
  private baseUrl = 'http://localhost:3000/api';

  constructor(private http: HttpClient) {}

  login(numeroControl: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.baseUrl}/login`, { numeroControl, password });
  }

  test(): Observable<any> {
    return this.http.get(`${this.baseUrl}/test`);
  }
}
