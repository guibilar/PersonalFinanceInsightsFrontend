import {Component, Input} from '@angular/core';
import {CurrencyPipe, KeyValuePipe} from '@angular/common';
import {LoaderComponent} from '../../../shared/ui/loader/loader.component';
import {CategoryColorHelper} from '../../../shared/utils/category-color-helper';
import {CategorizedReportOutputDto} from '../../../core/models/outputs/categorized-report-output-dto';

@Component({
  selector: 'app-current-month-categorized-table',
  templateUrl: './current-month-categorized-table.component.html',
  imports: [
    CurrencyPipe,
    KeyValuePipe,
    LoaderComponent
  ],
  styleUrls: ['./current-month-categorized-table.component.css']
})
export class CurrentMonthCategorizedTableComponent {
  @Input() report?: CategorizedReportOutputDto;

  get currentMonth() {
    return this.report?.monthlyData[0];
  }

  getCategoryColor(category: string): string {
    return CategoryColorHelper.getColor(category);
  }
}
