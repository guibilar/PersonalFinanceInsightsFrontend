import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MODULES } from '../../core/modules/module-registry';
import { IconComponent } from '../../shared/ui/icon/icon.component';

/** Every module from the registry: an active one opens, one still to come shows "Coming soon". */
@Component({
  selector: 'app-modules',
  imports: [RouterLink, IconComponent],
  template: `
    <div class="mb-4">
      <h1 class="h3 mb-1">Modules</h1>
      <p class="text-body-secondary mb-0">Each part of the app, in one place</p>
    </div>

    <ul class="row row-cols-1 row-cols-sm-2 row-cols-xl-3 g-3 list-unstyled mb-0">
      @for (module of modules; track module.id) {
        <li class="col">
          @if (module.status === 'active') {
            <a
              class="card h-100 module-card active-module"
              [routerLink]="module.route"
              [attr.data-module]="module.id"
            >
              <div class="card-body d-flex gap-3 align-items-start">
                <span class="module-icon"><app-icon [name]="module.icon" /></span>
                <div class="min-w-0 flex-grow-1">
                  <p class="fw-semibold mb-1">{{ module.name }}</p>
                  <p class="small text-body-secondary mb-0">{{ module.description }}</p>
                </div>
                <app-icon name="arrow-right" [size]="16" class="text-body-secondary" />
              </div>
            </a>
          } @else {
            <div
              class="card h-100 module-card coming-soon"
              [attr.data-module]="module.id"
              aria-disabled="true"
            >
              <div class="card-body d-flex gap-3 align-items-start">
                <span class="module-icon"><app-icon [name]="module.icon" /></span>
                <div class="min-w-0 flex-grow-1">
                  <p class="fw-semibold mb-1">
                    {{ module.name }}
                    <span class="badge text-bg-secondary ms-1 align-middle">Coming soon</span>
                  </p>
                  <p class="small text-body-secondary mb-0">{{ module.description }}</p>
                </div>
              </div>
            </div>
          }
        </li>
      }
    </ul>
  `,
  styles: `
    .module-card {
      color: inherit;
      text-decoration: none;
    }

    .active-module:hover {
      border-color: var(--bs-primary-border-subtle);
    }

    .active-module:focus-visible {
      outline: 2px solid var(--bs-primary);
      outline-offset: 2px;
    }

    .coming-soon {
      border-style: dashed;
      background: transparent;

      .module-icon {
        background: var(--bs-secondary-bg);
        color: var(--bs-secondary-color);
      }
    }

    .module-icon {
      display: inline-flex;
      padding: 0.625rem;
      border-radius: var(--bs-border-radius-lg);
      background: var(--bs-primary-bg-subtle);
      color: var(--bs-primary-text-emphasis);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModulesComponent {
  readonly modules = MODULES;
}
