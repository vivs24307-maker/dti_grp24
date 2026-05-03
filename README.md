# dti_grp24
# CineVerse - Movie Booking Web Application

CineVerse is a frontend movie ticketing platform built with vanilla web technologies. It simulates a complete booking flow from user authentication and movie selection to interactive seat mapping and dynamic price calculation. 

## 🚀 Features

*   **User Authentication:** Users can create an account and log in using persistent browser `localStorage`.
*   **Tiered Subscription Plans:** The login system requires users to choose between a Basic and a Premium plan.
*   **Dynamic Filtering:** The movie catalog allows users to filter available titles by genre, including Action, Sci-Fi, Drama, Comedy, Horror, and Biopic.
*   **Ticket Allocation:** Users must specify their desired number of tickets (between 1 and 5) before choosing a venue.
*   **Showtime Selection:** The application offers a selection of different theatres (PVR, INOX, Cinepolis) and corresponding time slots.
*   **Interactive Seat Mapping:** A visual seat map restricts users to their pre-selected ticket count and features distinct seating tiers like Premium, Recliner, and Sofa.
*   **Dynamic Checkout:** The system calculates the final price based on selected seat tiers and automatically applies a 10% discount for Premium plan members.

## 📂 File Structure & Navigation Flow

1.  **`first.html`**: The landing page featuring a hero section and trending movie grid[cite: 1].
2.  **`create_account.html`**: Handles new user registration and password confirmation[cite: 2].
3.  **`login.html`**: Validates user credentials against stored data and sets the session plan[cite: 3].
4.  **`movies.html`**: Displays the active user session and loads the interactive movie database[cite: 4].
5.  **`ticket_count.html`**: Captures the exact number of seats the user intends to book[cite: 5].
6.  **`theatre.html`**: Captures the preferred cinema location and showtime[cite: 6].
7.  **`seats.html`**: Generates a dynamic seating grid based on the chosen theatre and processes the final payment logic[cite: 7].

## 🛠️ Tech Stack

*   **HTML5:** Semantic structure and layout.
*   **CSS3:** Responsive grid layouts, interactive hover states, and thematic styling.
*   **JavaScript (Vanilla):** DOM manipulation, array filtering, and interactive UI logic.
*   **Web Storage API (`localStorage`):** Used extensively for state management to pass data (username, plan, selected movie, ticket count, and venue) across multiple static HTML pages.

## ⚙️ How to Run Locally

1. Clone or download this repository to your local machine.
2. Ensure all HTML files are located in the same directory.
3. Open `index.html` in any modern web browser to start the application flow. No server or build tools are required.
