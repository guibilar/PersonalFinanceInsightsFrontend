import {ChangeDetectionStrategy, Component, computed, input} from '@angular/core';
import {CurrencyPipe, KeyValuePipe} from '@angular/common';
import {CategoryColorHelper} from '../../../shared/utils/category-color-helper';
import {CategorizedReportOutputDto, MonthlyCategoryValuesDto} from '../../../core/models/outputs/categorized-report-output-dto';

@Component({
  selector: 'app-current-month-categorized-table',
  templateUrl: './current-month-categorized-table.component.html',
  imports: [CurrencyPipe, KeyValuePipe],
  styleUrls: ['./current-month-categorized-table.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CurrentMonthCategorizedTableComponent {
  readonly report = input.required<CategorizedReportOutputDto>();
  // Empty when the backend has no transactions for the current month.
  readonly currentMonth = computed<MonthlyCategoryValuesDto | undefined>(() => this.report().monthlyData[0]);

  getCategoryColor(category: string): string {
    return CategoryColorHelper.getColor(category);
  }
}
