#!/usr/bin/env python3
"""Generate capital city trivia questions and insert into trivia.db."""

import random
import sqlite3

import os
DB_PATH = os.path.join(os.path.dirname(__file__), "generation.db")
CATEGORY = "geography"

# Fix truncated/localized city names to their common English names
CITY_OVERRIDES = {
    "Algeria": "Algiers",
    "Austria": "Vienna",
    "Belgium": "Brussels",
    "China": "Beijing",
    "Dominican Republic": "Santo Domingo",
    "Ethiopia": "Addis Ababa",
    "Finland": "Helsinki",
    "Greece": "Athens",
    "Holy See (Vatican City State)": "Vatican City",
    "Italy": "Rome",
    "Luxembourg": "Luxembourg City",
    "Mexico": "Mexico City",
    "Mongolia": "Ulaanbaatar",
    "Myanmar": "Naypyidaw",
    "New Caledonia": "Nouméa",
    "Poland": "Warsaw",
    "Portugal": "Lisbon",
    "Romania": "Bucharest",
    "Sri Lanka": "Sri Jayawardenepura Kotte",
    "Vetican City": "Vatican City",  # typo in source data
}

# Difficulty classification
EASY_COUNTRIES = {
    "Afghanistan", "Argentina", "Australia", "Austria", "Belgium", "Bolivia",
    "Brazil", "Cambodia", "Canada", "Chile", "China", "Colombia", "Cuba",
    "Czech Republic", "Denmark", "Ecuador", "Egypt", "Ethiopia", "Finland",
    "France", "Germany", "Ghana", "Greece", "Hungary", "Iceland", "India",
    "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy", "Jamaica",
    "Japan", "Jordan", "Kenya", "Mexico", "Mongolia", "Morocco", "Myanmar",
    "Nepal", "Netherlands", "New Zealand", "Nigeria", "North Korea", "Norway",
    "Pakistan", "Panama", "Peru", "Philippines", "Poland", "Portugal",
    "Qatar", "Romania", "Russia", "Saudi Arabia", "Serbia", "Singapore",
    "Somalia", "South Africa", "South Korea", "Spain", "Sri Lanka", "Sudan",
    "Sweden", "Switzerland", "Syria", "Thailand", "Turkey", "Uganda",
    "Ukraine", "United Arab Emirates", "United Kingdom", "United States",
    "Venezuela", "Vietnam", "Yemen", "Zimbabwe",
}

MEDIUM_COUNTRIES = {
    "Albania", "Algeria", "Angola", "Armenia", "Azerbaijan", "Bahamas",
    "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belize", "Benin",
    "Bhutan", "Bosnia and Herzegovina", "Botswana", "Brunei", "Bulgaria",
    "Burkina Faso", "Burundi", "Cameroon", "Cape Verde", "Chad", "Comoros",
    "Congo", "Costa Rica", "Croatia", "Cyprus", "Djibouti", "Dominica",
    "Dominican Republic", "East Timor", "El Salvador", "Equatorial Guinea",
    "Eritrea", "Estonia", "Eswatini", "Fiji Islands", "Gabon", "Gambia",
    "Georgia", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana", "Haiti",
    "Honduras", "Ivory Coast", "Kazakhstan", "Kiribati", "Kuwait",
    "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia",
    "Libya", "Liechtenstein", "Lithuania", "Madagascar", "Malawi",
    "Malaysia", "Maldives", "Mali", "Malta", "Mauritania", "Mauritius",
    "Moldova", "Monaco", "Montenegro", "Mozambique", "Namibia", "Nicaragua",
    "Niger", "North Macedonia", "Oman", "Papua New Guinea", "Paraguay",
    "Rwanda", "Senegal", "Sierra Leone", "Slovakia", "Slovenia",
    "Solomon Islands", "South Sudan", "Suriname", "Tajikistan", "Tanzania",
    "The Democratic Republic of Congo", "Togo", "Trinidad and Tobago",
    "Tunisia", "Turkmenistan", "Tuvalu", "Uruguay", "Uzbekistan", "Vanuatu",
    "Zambia",
}

CAPITALS_DATA = [
    {"country": "Afghanistan", "city": "Kabul"},
    {"country": "Albania", "city": "Tirana"},
    {"country": "Algeria", "city": "Algiers"},
    {"country": "American Samoa", "city": "Fagatogo"},
    {"country": "Andorra", "city": "Andorra la Vella"},
    {"country": "Angola", "city": "Luanda"},
    {"country": "Anguilla", "city": "The Valley"},
    {"country": "Antigua and Barbuda", "city": "Saint John's"},
    {"country": "Argentina", "city": "Buenos Aires"},
    {"country": "Armenia", "city": "Yerevan"},
    {"country": "Aruba", "city": "Oranjestad"},
    {"country": "Australia", "city": "Canberra"},
    {"country": "Austria", "city": "Vienna"},
    {"country": "Azerbaijan", "city": "Baku"},
    {"country": "Bahamas", "city": "Nassau"},
    {"country": "Bahrain", "city": "Manama"},
    {"country": "Bangladesh", "city": "Dhaka"},
    {"country": "Barbados", "city": "Bridgetown"},
    {"country": "Belarus", "city": "Minsk"},
    {"country": "Belgium", "city": "Brussels"},
    {"country": "Belize", "city": "Belmopan"},
    {"country": "Benin", "city": "Porto-Novo"},
    {"country": "Bermuda", "city": "Hamilton"},
    {"country": "Bhutan", "city": "Thimphu"},
    {"country": "Bolivia", "city": "La Paz"},
    {"country": "Bosnia and Herzegovina", "city": "Sarajevo"},
    {"country": "Botswana", "city": "Gaborone"},
    {"country": "Brazil", "city": "Brasília"},
    {"country": "Brunei", "city": "Bandar Seri Begawan"},
    {"country": "Bulgaria", "city": "Sofia"},
    {"country": "Burkina Faso", "city": "Ouagadougou"},
    {"country": "Burundi", "city": "Bujumbura"},
    {"country": "Cambodia", "city": "Phnom Penh"},
    {"country": "Cameroon", "city": "Yaoundé"},
    {"country": "Canada", "city": "Ottawa"},
    {"country": "Cape Verde", "city": "Praia"},
    {"country": "Cayman Islands", "city": "George Town"},
    {"country": "Central African Republic", "city": "Bangui"},
    {"country": "Chad", "city": "N'Djamena"},
    {"country": "Chile", "city": "Santiago"},
    {"country": "China", "city": "Beijing"},
    {"country": "Christmas Island", "city": "Flying Fish Cove"},
    {"country": "Cocos (Keeling) Islands", "city": "West Island"},
    {"country": "Colombia", "city": "Bogotá"},
    {"country": "Comoros", "city": "Moroni"},
    {"country": "Congo", "city": "Brazzaville"},
    {"country": "Cook Islands", "city": "Avarua"},
    {"country": "Costa Rica", "city": "San José"},
    {"country": "Croatia", "city": "Zagreb"},
    {"country": "Cuba", "city": "Havana"},
    {"country": "Cyprus", "city": "Nicosia"},
    {"country": "Czech Republic", "city": "Prague"},
    {"country": "Denmark", "city": "Copenhagen"},
    {"country": "Djibouti", "city": "Djibouti"},
    {"country": "Dominica", "city": "Roseau"},
    {"country": "Dominican Republic", "city": "Santo Domingo"},
    {"country": "East Timor", "city": "Dili"},
    {"country": "Ecuador", "city": "Quito"},
    {"country": "Egypt", "city": "Cairo"},
    {"country": "El Salvador", "city": "San Salvador"},
    {"country": "England", "city": "London"},
    {"country": "Equatorial Guinea", "city": "Malabo"},
    {"country": "Eritrea", "city": "Asmara"},
    {"country": "Estonia", "city": "Tallinn"},
    {"country": "Eswatini", "city": "Mbabane"},
    {"country": "Ethiopia", "city": "Addis Ababa"},
    {"country": "Falkland Islands", "city": "Stanley"},
    {"country": "Faroe Islands", "city": "Tórshavn"},
    {"country": "Fiji Islands", "city": "Suva"},
    {"country": "Finland", "city": "Helsinki"},
    {"country": "France", "city": "Paris"},
    {"country": "French Guiana", "city": "Cayenne"},
    {"country": "French Polynesia", "city": "Papeete"},
    {"country": "Gabon", "city": "Libreville"},
    {"country": "Gambia", "city": "Banjul"},
    {"country": "Georgia", "city": "Tbilisi"},
    {"country": "Germany", "city": "Berlin"},
    {"country": "Ghana", "city": "Accra"},
    {"country": "Gibraltar", "city": "Gibraltar"},
    {"country": "Greece", "city": "Athens"},
    {"country": "Greenland", "city": "Nuuk"},
    {"country": "Grenada", "city": "Saint George's"},
    {"country": "Guadeloupe", "city": "Basse-Terre"},
    {"country": "Guam", "city": "Hagåtña"},
    {"country": "Guatemala", "city": "Guatemala City"},
    {"country": "Guinea", "city": "Conakry"},
    {"country": "Guinea-Bissau", "city": "Bissau"},
    {"country": "Guyana", "city": "Georgetown"},
    {"country": "Haiti", "city": "Port-au-Prince"},
    {"country": "Holy See (Vatican City State)", "city": "Vatican City"},
    {"country": "Honduras", "city": "Tegucigalpa"},
    {"country": "Hong Kong", "city": "Victoria"},
    {"country": "Hungary", "city": "Budapest"},
    {"country": "Iceland", "city": "Reykjavík"},
    {"country": "India", "city": "New Delhi"},
    {"country": "Indonesia", "city": "Jakarta"},
    {"country": "Iran", "city": "Tehran"},
    {"country": "Iraq", "city": "Baghdad"},
    {"country": "Ireland", "city": "Dublin"},
    {"country": "Israel", "city": "Jerusalem"},
    {"country": "Italy", "city": "Rome"},
    {"country": "Ivory Coast", "city": "Yamoussoukro"},
    {"country": "Jamaica", "city": "Kingston"},
    {"country": "Japan", "city": "Tokyo"},
    {"country": "Jordan", "city": "Amman"},
    {"country": "Kazakhstan", "city": "Astana"},
    {"country": "Kenya", "city": "Nairobi"},
    {"country": "Kiribati", "city": "Tarawa"},
    {"country": "Kuwait", "city": "Kuwait City"},
    {"country": "Kyrgyzstan", "city": "Bishkek"},
    {"country": "Laos", "city": "Vientiane"},
    {"country": "Latvia", "city": "Riga"},
    {"country": "Lebanon", "city": "Beirut"},
    {"country": "Lesotho", "city": "Maseru"},
    {"country": "Liberia", "city": "Monrovia"},
    {"country": "Libya", "city": "Tripoli"},
    {"country": "Liechtenstein", "city": "Vaduz"},
    {"country": "Lithuania", "city": "Vilnius"},
    {"country": "Luxembourg", "city": "Luxembourg City"},
    {"country": "Macao", "city": "Macao"},
    {"country": "North Macedonia", "city": "Skopje"},
    {"country": "Madagascar", "city": "Antananarivo"},
    {"country": "Malawi", "city": "Lilongwe"},
    {"country": "Malaysia", "city": "Kuala Lumpur"},
    {"country": "Maldives", "city": "Malé"},
    {"country": "Mali", "city": "Bamako"},
    {"country": "Malta", "city": "Valletta"},
    {"country": "Marshall Islands", "city": "Majuro"},
    {"country": "Martinique", "city": "Fort-de-France"},
    {"country": "Mauritania", "city": "Nouakchott"},
    {"country": "Mauritius", "city": "Port Louis"},
    {"country": "Mayotte", "city": "Mamoudzou"},
    {"country": "Mexico", "city": "Mexico City"},
    {"country": "Micronesia, Federated States of", "city": "Palikir"},
    {"country": "Moldova", "city": "Chișinău"},
    {"country": "Monaco", "city": "Monaco"},
    {"country": "Mongolia", "city": "Ulaanbaatar"},
    {"country": "Montenegro", "city": "Podgorica"},
    {"country": "Montserrat", "city": "Plymouth"},
    {"country": "Morocco", "city": "Rabat"},
    {"country": "Mozambique", "city": "Maputo"},
    {"country": "Myanmar", "city": "Naypyidaw"},
    {"country": "Namibia", "city": "Windhoek"},
    {"country": "Nauru", "city": "Yaren"},
    {"country": "Nepal", "city": "Kathmandu"},
    {"country": "Netherlands", "city": "Amsterdam"},
    {"country": "Netherlands Antilles", "city": "Willemstad"},
    {"country": "New Caledonia", "city": "Nouméa"},
    {"country": "New Zealand", "city": "Wellington"},
    {"country": "Nicaragua", "city": "Managua"},
    {"country": "Niger", "city": "Niamey"},
    {"country": "Nigeria", "city": "Abuja"},
    {"country": "Niue", "city": "Alofi"},
    {"country": "Norfolk Island", "city": "Kingston"},
    {"country": "North Korea", "city": "Pyongyang"},
    {"country": "Northern Ireland", "city": "Belfast"},
    {"country": "Northern Mariana Islands", "city": "Saipan"},
    {"country": "Norway", "city": "Oslo"},
    {"country": "Oman", "city": "Muscat"},
    {"country": "Pakistan", "city": "Islamabad"},
    {"country": "Palau", "city": "Ngerulmud"},
    {"country": "Palestine", "city": "Ramallah"},
    {"country": "Panama", "city": "Panama City"},
    {"country": "Papua New Guinea", "city": "Port Moresby"},
    {"country": "Paraguay", "city": "Asunción"},
    {"country": "Peru", "city": "Lima"},
    {"country": "Philippines", "city": "Manila"},
    {"country": "Pitcairn", "city": "Adamstown"},
    {"country": "Poland", "city": "Warsaw"},
    {"country": "Portugal", "city": "Lisbon"},
    {"country": "Puerto Rico", "city": "San Juan"},
    {"country": "Qatar", "city": "Doha"},
    {"country": "Reunion", "city": "Saint-Denis"},
    {"country": "Romania", "city": "Bucharest"},
    {"country": "Russia", "city": "Moscow"},
    {"country": "Rwanda", "city": "Kigali"},
    {"country": "Saint Helena", "city": "Jamestown"},
    {"country": "Saint Kitts and Nevis", "city": "Basseterre"},
    {"country": "Saint Lucia", "city": "Castries"},
    {"country": "Saint Pierre and Miquelon", "city": "Saint-Pierre"},
    {"country": "Saint Vincent and the Grenadines", "city": "Kingstown"},
    {"country": "Samoa", "city": "Apia"},
    {"country": "San Marino", "city": "San Marino"},
    {"country": "Sao Tome and Principe", "city": "São Tomé"},
    {"country": "Saudi Arabia", "city": "Riyadh"},
    {"country": "Scotland", "city": "Edinburgh"},
    {"country": "Senegal", "city": "Dakar"},
    {"country": "Serbia", "city": "Belgrade"},
    {"country": "Seychelles", "city": "Victoria"},
    {"country": "Sierra Leone", "city": "Freetown"},
    {"country": "Singapore", "city": "Singapore"},
    {"country": "Slovakia", "city": "Bratislava"},
    {"country": "Slovenia", "city": "Ljubljana"},
    {"country": "Solomon Islands", "city": "Honiara"},
    {"country": "Somalia", "city": "Mogadishu"},
    {"country": "South Africa", "city": "Pretoria"},
    {"country": "South Korea", "city": "Seoul"},
    {"country": "South Sudan", "city": "Juba"},
    {"country": "Spain", "city": "Madrid"},
    {"country": "Sri Lanka", "city": "Sri Jayawardenepura Kotte"},
    {"country": "Sudan", "city": "Khartoum"},
    {"country": "Suriname", "city": "Paramaribo"},
    {"country": "Svalbard and Jan Mayen", "city": "Longyearbyen"},
    {"country": "Sweden", "city": "Stockholm"},
    {"country": "Switzerland", "city": "Bern"},
    {"country": "Syria", "city": "Damascus"},
    {"country": "Tajikistan", "city": "Dushanbe"},
    {"country": "Tanzania", "city": "Dodoma"},
    {"country": "Thailand", "city": "Bangkok"},
    {"country": "The Democratic Republic of Congo", "city": "Kinshasa"},
    {"country": "Togo", "city": "Lomé"},
    {"country": "Tokelau", "city": "Fakaofo"},
    {"country": "Tonga", "city": "Nukuʻalofa"},
    {"country": "Trinidad and Tobago", "city": "Port of Spain"},
    {"country": "Tunisia", "city": "Tunis"},
    {"country": "Turkey", "city": "Ankara"},
    {"country": "Turkmenistan", "city": "Ashgabat"},
    {"country": "Turks and Caicos Islands", "city": "Cockburn Town"},
    {"country": "Tuvalu", "city": "Funafuti"},
    {"country": "Uganda", "city": "Kampala"},
    {"country": "Ukraine", "city": "Kyiv"},
    {"country": "United Arab Emirates", "city": "Abu Dhabi"},
    {"country": "United Kingdom", "city": "London"},
    {"country": "United States", "city": "Washington, D.C."},
    {"country": "Uruguay", "city": "Montevideo"},
    {"country": "Uzbekistan", "city": "Tashkent"},
    {"country": "Vanuatu", "city": "Port Vila"},
    {"country": "Venezuela", "city": "Caracas"},
    {"country": "Vatican City", "city": "Vatican City"},
    {"country": "Vietnam", "city": "Hanoi"},
    {"country": "Virgin Islands, British", "city": "Road Town"},
    {"country": "Virgin Islands, U.S.", "city": "Charlotte Amalie"},
    {"country": "Wales", "city": "Cardiff"},
    {"country": "Wallis and Futuna", "city": "Mata-Utu"},
    {"country": "Western Sahara", "city": "El Aaiún"},
    {"country": "Yemen", "city": "Sanaa"},
    {"country": "Zambia", "city": "Lusaka"},
    {"country": "Zimbabwe", "city": "Harare"},
]


def get_difficulty(country: str) -> str:
    if country in EASY_COUNTRIES:
        return "easy"
    if country in MEDIUM_COUNTRIES:
        return "medium"
    return "hard"


def main():
    random.seed(42)

    all_capitals = [d["city"] for d in CAPITALS_DATA]

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    inserted = 0
    skipped = 0

    for entry in CAPITALS_DATA:
        country = entry["country"]
        capital = entry["city"]

        # Pick 3 distractors from other capitals
        other_capitals = [c for c in all_capitals if c != capital]
        distractors = random.sample(other_capitals, 3)

        text = f"What is the capital of {country}?"
        difficulty = get_difficulty(country)

        try:
            cur.execute(
                """INSERT INTO questions
                   (source_type, text, correct_answer, distractor_1, distractor_2, distractor_3,
                    category, difficulty, confidence_score, is_duplicate, grounded, verified,
                    rejected, human_approved, edited, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))""",
                ("seed", text, capital, distractors[0], distractors[1], distractors[2],
                 CATEGORY, difficulty, 1.0, 0, 1, 1, 0, 1, 0),
            )
            inserted += 1
        except sqlite3.IntegrityError as e:
            print(f"Skipped {country}: {e}")
            skipped += 1

    conn.commit()
    conn.close()
    print(f"Done. Inserted: {inserted}, skipped: {skipped}")


if __name__ == "__main__":
    main()
