#!/usr/bin/env python3
"""Write the unit test results of a CI run as GitHub annotations.

Task sessions and reviewers can read annotations without the CI log. This script reads the JUnit
XML report that `npm run test:ci` writes and prints:

- one notice with the totals: passed, failed and skipped;
- one error for each failed test, with the test name and the first lines of its message;
- a warning if the report is missing (for example, the build failed before the tests).

GitHub shows at most 10 errors for each step. After 9 failed tests, one more error gives the
count of the others.

Usage: scripts/test-annotations.py [report] [label]
Python standard library only. The exit code is always 0: the test step itself fails the job.
"""

import sys
import xml.etree.ElementTree as ET
from pathlib import Path

MAX_ERRORS = 10
MESSAGE_LINES = 6


def escape_data(text: str) -> str:
    return text.replace('%', '%25').replace('\r', '%0D').replace('\n', '%0A')


def escape_property(text: str) -> str:
    return escape_data(text).replace(':', '%3A').replace(',', '%2C')


def annotate(kind: str, title: str, message: str) -> None:
    print(f'::{kind} title={escape_property(title)}::{escape_data(message)}')


def first_lines(text: str) -> str:
    lines = [line.rstrip() for line in text.strip().splitlines()]
    lines = [line for line in lines if line]
    shown = lines[:MESSAGE_LINES]
    if len(lines) > MESSAGE_LINES:
        shown.append('…')
    return '\n'.join(shown)


def main() -> int:
    report = Path(sys.argv[1] if len(sys.argv) > 1 else 'test-results/junit.xml')
    label = sys.argv[2] if len(sys.argv) > 2 else 'Unit tests'

    if not report.is_file():
        annotate('warning', f'{label}: no results', f'No test report at {report}. The tests did not run.')
        return 0

    try:
        root = ET.parse(report).getroot()
    except ET.ParseError as error:
        annotate('warning', f'{label}: no results', f'The test report {report} is not valid XML: {error}')
        return 0

    passed = skipped = 0
    failures: list[tuple[str, str]] = []
    files = set()
    for case in root.iter('testcase'):
        files.add(case.get('classname', ''))
        problem = case.find('failure')
        if problem is None:
            problem = case.find('error')
        if problem is not None:
            file, test = case.get('classname', ''), case.get('name', '')
            name = test if not file or file == test else f'{file} > {test}'
            text = problem.text if problem.text and problem.text.strip() else problem.get('message', '')
            failures.append((name, first_lines(text or 'No message.')))
        elif case.find('skipped') is not None:
            skipped += 1
        else:
            passed += 1

    annotate(
        'notice',
        f'{label}: totals',
        f'{passed} passed, {len(failures)} failed, {skipped} skipped. Test files: {len(files)}.',
    )

    shown = failures if len(failures) <= MAX_ERRORS else failures[: MAX_ERRORS - 1]
    for name, message in shown:
        annotate('error', f'Failed: {name}', message)
    if len(shown) < len(failures):
        others = len(failures) - len(shown)
        annotate('error', f'{label}: more failures', f'{others} more failed tests. See the test report.')

    return 0


if __name__ == '__main__':
    sys.exit(main())
