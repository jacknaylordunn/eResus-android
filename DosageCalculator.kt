package uk.co.aegismedicalsolutions.eresus.services

enum class PatientAgeCategory(val descriptionText: String) {
    ADULT("≥12 years / Adult"),
    ELEVEN_YEARS("11 years"),
    TEN_YEARS("10 years"),
    NINE_YEARS("9 years"),
    EIGHT_YEARS("8 years"),
    SEVEN_YEARS("7 years"),
    SIX_YEARS("6 years"),
    FIVE_YEARS("5 years"),
    FOUR_YEARS("4 years"),
    THREE_YEARS("3 years"),
    TWO_YEARS("2 years"),
    EIGHTEEN_MONTHS("18 months"),
    TWELVE_MONTHS("12 months"),
    NINE_MONTHS("9 months"),
    SIX_MONTHS("6 months"),
    THREE_MONTHS("3 months"),
    ONE_MONTH("1 month"),
    POST_BIRTH_TO_ONE_MONTH("Post-birth to 1 month"),
    AT_BIRTH("At birth")
}


object DosageCalculator {
    fun calculateAdrenalineDose(forAge: PatientAgeCategory): String {
        return when (forAge) {
            PatientAgeCategory.ADULT -> "1mg"
            PatientAgeCategory.ELEVEN_YEARS -> "350mcg"
            PatientAgeCategory.TEN_YEARS -> "320mcg"
            PatientAgeCategory.NINE_YEARS -> "300mcg"
            PatientAgeCategory.EIGHT_YEARS -> "260mcg"
            PatientAgeCategory.SEVEN_YEARS -> "230mcg"
            PatientAgeCategory.SIX_YEARS -> "210mcg"
            PatientAgeCategory.FIVE_YEARS -> "190mcg"
            PatientAgeCategory.FOUR_YEARS -> "160mcg"
            PatientAgeCategory.THREE_YEARS -> "140mcg"
            PatientAgeCategory.TWO_YEARS -> "120mcg"
            PatientAgeCategory.EIGHTEEN_MONTHS -> "110mcg"
            PatientAgeCategory.TWELVE_MONTHS -> "100mcg"
            PatientAgeCategory.NINE_MONTHS -> "90mcg"
            PatientAgeCategory.SIX_MONTHS -> "80mcg"
            PatientAgeCategory.THREE_MONTHS -> "60mcg"
            PatientAgeCategory.ONE_MONTH -> "50mcg"
            PatientAgeCategory.POST_BIRTH_TO_ONE_MONTH -> "50mcg"
            PatientAgeCategory.AT_BIRTH -> "70mcg"
        }
    }

    fun calculateAmiodaroneDose(forAge: PatientAgeCategory, doseNumber: Int): String? {
        return when (forAge) {
            PatientAgeCategory.ADULT -> if (doseNumber == 1) "300mg" else "150mg"
            PatientAgeCategory.ELEVEN_YEARS -> "180mg"
            PatientAgeCategory.TEN_YEARS -> "160mg"
            PatientAgeCategory.NINE_YEARS -> "150mg"
            PatientAgeCategory.EIGHT_YEARS -> "130mg"
            PatientAgeCategory.SEVEN_YEARS -> "120mg"
            PatientAgeCategory.SIX_YEARS -> "100mg"
            PatientAgeCategory.FIVE_YEARS -> "100mg"
            PatientAgeCategory.FOUR_YEARS -> "80mg"
            PatientAgeCategory.THREE_YEARS -> "70mg"
            PatientAgeCategory.TWO_YEARS -> "60mg"
            PatientAgeCategory.EIGHTEEN_MONTHS -> "55mg"
            PatientAgeCategory.TWELVE_MONTHS -> "50mg"
            PatientAgeCategory.NINE_MONTHS -> "45mg"
            PatientAgeCategory.SIX_MONTHS -> "40mg"
            PatientAgeCategory.THREE_MONTHS -> "30mg"
            PatientAgeCategory.ONE_MONTH -> "25mg"
            PatientAgeCategory.POST_BIRTH_TO_ONE_MONTH, PatientAgeCategory.AT_BIRTH -> null // N/A
        }
    }
}
