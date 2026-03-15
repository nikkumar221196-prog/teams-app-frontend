import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class UserService {
  private _name = '';
  private _organization = '';

  set name(n: string) { this._name = n; }
  get name(): string { return this._name; }

  set organization(o: string) { this._organization = o; }
  get organization(): string { return this._organization; }

  isLoggedIn(): boolean { return !!this._name && !!this._organization; }
}
