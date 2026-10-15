import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { PeopleRepository } from '../../../core/api/people-repository';
import { DataChangesService } from '../../../core/data/data-changes.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import {
  PersonFieldsComponent,
  createPersonForm,
  personDetailsOf,
} from '../person-fields/person-fields.component';
import { peopleError } from '../people';

/** A new person. Capture and the People page open it as `/people/new`. After the save, the person opens. */
@Component({
  selector: 'app-person-new',
  imports: [RouterLink, PersonFieldsComponent],
  template: `
    <a class="back-link small d-inline-flex align-items-center gap-1 mb-2" routerLink="/people"
      >← People</a
    >
    <h1 class="h3 mb-3">Add person</h1>

    @if (!canWrite()) {
      <p class="alert alert-secondary" data-testid="read-only">
        This account can only read the people.
      </p>
    } @else {
      <div class="card">
        <div class="card-body">
          <form novalidate (submit)="$event.preventDefault(); save()">
            <app-person-fields [form]="form" />
            <div class="d-flex justify-content-end gap-2 mt-3">
              <a class="btn btn-outline-secondary" routerLink="/people">Cancel</a>
              <button type="submit" class="btn btn-primary" [disabled]="busy()">
                {{ busy() ? 'Adding…' : 'Add person' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
  styles: `
    .back-link {
      color: var(--bs-secondary-color);
      text-decoration: none;
      &:hover {
        color: var(--bs-emphasis-color);
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonNewComponent {
  private readonly repository = inject(PeopleRepository);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);
  private readonly dataChanges = inject(DataChangesService);
  readonly canWrite = inject(AuthService).canWrite;

  readonly form = createPersonForm();
  readonly busy = signal(false);

  save(): void {
    if (this.busy()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.busy.set(true);
    this.repository.create(personDetailsOf(this.form)).subscribe({
      next: (person) => {
        this.busy.set(false);
        this.dataChanges.changed();
        this.toasts.success(`Added “${person.person.name}”`);
        void this.router.navigate(['/people', person.person.id]);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.toasts.error(peopleError(error, 'Could not add the person.'));
      },
    });
  }
}
