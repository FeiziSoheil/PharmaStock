package reconciliation

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"pharmastock/backend/pkg/validator"
)

// gregorianToJalali converts a civil Gregorian date to Jalali (year, month, day) using Borkowski's algorithm.
func gregorianToJalali(gy, gm, gd int) (int, int, int) {
	gDaysInMonth := []int{31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31}
	jDaysInMonth := []int{31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 29}

	gy2 := gy - 1600
	gm2 := gm - 1
	gd2 := gd - 1

	gDayNo := 365*gy2 + (gy2+3)/4 - (gy2+99)/100 + (gy2+399)/400
	for i := 0; i < gm2; i++ {
		gDayNo += gDaysInMonth[i]
	}
	if gm2 > 1 && ((gy%4 == 0 && gy%100 != 0) || (gy%400 == 0)) {
		gDayNo++
	}
	gDayNo += gd2

	jDayNo := gDayNo - 79
	jNp := jDayNo / 12053
	jDayNo %= 12053

	jy := 979 + 33*jNp + 4*(jDayNo/1461)
	jDayNo %= 1461

	if jDayNo >= 366 {
		jy += (jDayNo - 1) / 365
		jDayNo = (jDayNo - 1) % 365
	}

	var jm, jd int
	for i := 0; i < 11 && jDayNo >= jDaysInMonth[i]; i++ {
		jDayNo -= jDaysInMonth[i]
		jm++
	}
	jm++
	jd = jDayNo + 1
	return jy, jm, jd
}

// jalaliToGregorian converts a Jalali (year, month, day) date to Gregorian (year, month, day).
func jalaliToGregorian(jy, jm, jd int) (int, int, int) {
	gDaysInMonth := []int{31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31}
	jDaysInMonth := []int{31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 29}

	jy2 := jy - 979
	jm2 := jm - 1
	jd2 := jd - 1

	jDayNo := 365*jy2 + (jy2/33)*8 + ((jy2%33)+3)/4
	for i := 0; i < jm2; i++ {
		jDayNo += jDaysInMonth[i]
	}
	jDayNo += jd2

	gDayNo := jDayNo + 79
	gy := 1600 + 400*(gDayNo/146097)
	gDayNo %= 146097

	leap := true
	if gDayNo >= 36525 {
		gDayNo--
		gy += 100 * (gDayNo / 36524)
		gDayNo %= 36524
		if gDayNo >= 365 {
			gDayNo++
		} else {
			leap = false
		}
	}

	gy += 4 * (gDayNo / 1461)
	gDayNo %= 1461

	if gDayNo >= 366 {
		leap = false
		gDayNo--
		gy += gDayNo / 365
		gDayNo %= 365
	}

	var gm int
	for i := 0; ; i++ {
		days := gDaysInMonth[i]
		if i == 1 && leap {
			days++
		}
		if gDayNo < days {
			gm = i + 1
			break
		}
		gDayNo -= days
	}
	gd := gDayNo + 1
	return gy, gm, gd
}

// ParseFlexibleDate normalizes Jalali (1405/02/15, ۱۴۰۵/۰۲/۱۵), ISO (2026-06-01), or Excel serial dates to ISO YYYY-MM-DD.
func ParseFlexibleDate(raw string) (iso string, jalaliDisplay string) {
	cleaned := validator.NormalizeFa(raw)
	cleaned = strings.TrimSpace(cleaned)
	if cleaned == "" {
		return "", ""
	}

	// Excel serial date (integer days since 1899-12-30)
	if serial, err := strconv.ParseFloat(cleaned, 64); err == nil && serial > 20000 && serial < 90000 {
		base := time.Date(1899, 12, 30, 0, 0, 0, 0, time.UTC)
		t := base.AddDate(0, 0, int(serial))
		jy, jm, jd := gregorianToJalali(t.Year(), int(t.Month()), t.Day())
		return t.Format("2006-01-02"), fmt.Sprintf("%04d/%02d/%02d", jy, jm, jd)
	}

	sep := "/"
	if strings.Contains(cleaned, "-") {
		sep = "-"
	}
	parts := strings.Split(cleaned, sep)
	if len(parts) != 3 {
		return "", cleaned
	}
	y, err1 := strconv.Atoi(strings.TrimSpace(parts[0]))
	m, err2 := strconv.Atoi(strings.TrimSpace(parts[1]))
	d, err3 := strconv.Atoi(strings.TrimSpace(parts[2]))
	if err1 != nil || err2 != nil || err3 != nil || m < 1 || m > 12 || d < 1 || d > 31 {
		return "", cleaned
	}

	// Jalali year range (1300..1550)
	if y >= 1300 && y <= 1550 {
		gy, gm, gd := jalaliToGregorian(y, m, d)
		return fmt.Sprintf("%04d-%02d-%02d", gy, gm, gd), fmt.Sprintf("%04d/%02d/%02d", y, m, d)
	}

	// Gregorian year range (1990..2150)
	if y >= 1990 && y <= 2150 {
		jy, jm, jd := gregorianToJalali(y, m, d)
		return fmt.Sprintf("%04d-%02d-%02d", y, m, d), fmt.Sprintf("%04d/%02d/%02d", jy, jm, jd)
	}

	return "", cleaned
}
