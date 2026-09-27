# React TypeScript Template

A modern React application template built with TypeScript, React, and Radix UI components. This template provides a solid foundation for building web applications with a beautiful UI and well-organized code structure. It includes a task management feature as an example implementation.

## Features

- 🎨 Modern UI with Radix UI components
- 🌙 Light and dark mode support
- 📱 Responsive design for all device sizes
- ✅ Task management (create, update, delete tasks)
- 🏷️ Task filtering by status
- 🔄 State management with Zustand
- 📝 Form validation with Zod and React Hook Form
- 🚀 Fast development with Vite
- 🧩 TypeScript for type safety

## Project Structure

This template follows a technical responsibility organization pattern, where code is organized by technical function rather than by domain:

```
react-typescript-template/
├── public/                  # Static assets
├── src/
│   ├── api/                 # API client and service definitions
│   ├── assets/              # Images, fonts, and other assets
│   ├── components/          # Reusable UI components
│   │   ├── task/            # Task-specific components
│   │   └── ui/              # UI components (buttons, inputs, etc.)
│   ├── config/              # Application configuration (Firebase, etc.)
│   ├── hooks/               # Custom React hooks
│   ├── layouts/             # Layout components
│   ├── pages/               # Page components
│   │   └── tasks/           # Task pages
│   ├── routes/              # Routing configuration
│   ├── schemas/             # Zod validation schemas
│   │   └── task/            # Task-related schemas
│   ├── store/               # Zustand state management
│   ├── styles/              # Global styles
│   ├── types/               # TypeScript type definitions
│   │   └── task/            # Task-related types
│   ├── utils/               # Utility functions
│   ├── App.tsx              # Main App component
│   └── index.tsx            # Application entry point
├── index.html               # HTML entry point
├── package.json             # Dependencies and scripts
├── postcss.config.js        # PostCSS configuration
├── tailwind.config.js       # Tailwind CSS configuration
├── tsconfig.json            # TypeScript configuration
├── vite.config.js           # Vite configuration
└── LICENSE                  # MIT License file
```

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/react-typescript-template.git
cd react-typescript-template
```

2. Install dependencies:

```bash
npm install
# or
yarn install
```

3. Start the development server:

```bash
npm run dev
# or
yarn dev
```

4. Open your browser and navigate to `http://localhost:5173`

## Customization

### Styling

This template uses Tailwind CSS for styling. You can customize the theme in the `tailwind.config.js` file.

### Adding New Features

To add a new feature:

1. Create appropriate directories in the relevant technical areas (components, pages, types, schemas, etc.)
2. Add components, pages, and other necessary files
3. Update the routes in `src/routes/AppRoutes.tsx` to include your new feature

### Task Management

This template includes a complete task management system with the following features:

- Create, read, update, and delete tasks
- Filter tasks by status
- Set task priorities
- Set due dates for tasks
- Responsive UI for all device sizes

## Deployment

To build the application for production:

```bash
npm run build
# or
yarn build
```

This will generate a `dist` directory with the production-ready files. The application uses hash routing, making it compatible with static hosting services like GitHub Pages, Netlify, or Vercel.

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.
