import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ChangePasswordFormComponent } from './change-password-form.component';

describe('ChangePasswordFormComponent', () => {
  let fixture: ComponentFixture<ChangePasswordFormComponent>;
  let component: ChangePasswordFormComponent;
  let http: HttpTestingController;
  let changed: number;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [ChangePasswordFormComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ChangePasswordFormComponent);
    component = fixture.componentInstance;
    changed = 0;
    component.changed.subscribe(() => changed++);
    await fixture.whenStable();
  });

  afterEach(() => http.verify());

  const valid = {
    currentPassword: 'old password',
    newPassword: 'a long new passphrase',
    confirmPassword: 'a long new passphrase',
  };

  it('needs 12 characters and a matching confirmation before sending anything', () => {
    component.form.setValue({ ...valid, newPassword: 'short', confirmPassword: 'short' });
    component.onSubmit();
    expect(component.form.controls.newPassword.hasError('minlength')).toBeTrue();

    component.form.setValue({ ...valid, confirmPassword: 'something else entirely' });
    component.onSubmit();
    expect(component.form.hasError('mismatch')).toBeTrue();
  });

  it('sends the current and new password, then reports success', () => {
    component.form.setValue(valid);
    component.onSubmit();

    const request = http.expectOne({ method: 'POST', url: '/api/Auth/change-password' });
    expect(request.request.body).toEqual({
      currentPassword: 'old password',
      newPassword: 'a long new passphrase',
    });
    request.flush(null, { status: 204, statusText: 'No Content' });

    expect(changed).toBe(1);
  });

  it('shows the API message next to the field it is about', async () => {
    component.form.setValue(valid);
    component.onSubmit();
    http
      .expectOne('/api/Auth/change-password')
      .flush(
        { errors: { CurrentPassword: ['Incorrect password.'] } },
        { status: 400, statusText: 'Bad Request' },
      );
    await fixture.whenStable();

    expect(changed).toBe(0);
    expect(component.serverErrors().currentPassword).toBe('Incorrect password.');
    const input: HTMLInputElement = fixture.nativeElement.querySelector('#current-password');
    expect(input.classList).toContain('is-invalid');
  });
});
