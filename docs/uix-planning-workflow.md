# UI/UX Planning Workflow with Frame0

Complete guide for designing mobile app interfaces using Frame0 and the mobile platform.

---

## Overview

Frame0 is a visual design tool integrated via MCP that allows you to:
- Create mockups for phone, tablet, desktop, browser, watch, TV
- Design UI components (buttons, forms, navigation)
- Export designs as images
- Collaborate on design iterations

Combined with the mobile platform, you can go from mockup to working app in hours.

---

## Workflow: Mockup to Mobile App

### Phase 1: Design in Frame0 (Browser Project)

**1. Open Claude.ai Browser Project**
   - Go to claude.ai
   - Select your project (e.g., "Consilio BP", "OpenHorizon BP")
   - Frame0 tools are automatically available

**2. Create Mobile App Mockup**

```
Me: Create a mobile app login screen with:
- App logo at top
- Email input field
- Password input field
- Login button
- "Forgot password?" link
- "Sign up" link at bottom

Use modern design with rounded corners and a blue color scheme.
```

**Example Claude Response:**

```typescript
// Claude will execute these Frame0 commands:

1. add_page({ name: "Login Screen" })

2. create_frame({
   frameType: "phone",
   name: "iPhone 14 Pro",
   fillColor: "#F5F5F5"
})

3. create_rectangle({
   name: "Header Background",
   left: 0, top: 0,
   width: 393, height: 120,
   fillColor: "#2563EB",
   corners: [0, 0, 24, 24]
})

4. search_icons({ keyword: "logo" })
5. create_icon({
   name: "app-logo",
   left: 171, top: 40,
   size: "large",
   strokeColor: "#FFFFFF"
})

6. create_text({
   name: "App Name",
   text: "MyApp",
   left: 20, top: 100,
   fontSize: 32,
   fontColor: "#FFFFFF",
   type: "heading"
})

7. create_rectangle({
   name: "Email Input",
   left: 20, top: 160,
   width: 353, height: 48,
   fillColor: "#FFFFFF",
   corners: [8, 8, 8, 8]
})

8. create_text({
   name: "Email Placeholder",
   text: "Email address",
   left: 32, top: 172,
   fontSize: 16,
   fontColor: "#9CA3AF"
})

... (continues for all UI elements)

9. export_page_as_image({ format: "image/png" })
```

**Result:** PNG image of the mockup

### Phase 2: Create Mobile Project

**3. Switch to CLI or Continue in Browser**

```bash
# Via MCP tool (in browser or CLI with MCP server)
mobile_create_project({
  project_name: "myapp",
  framework: "react-native"
})

# Or via CLI directly
cd /home/samuel/sv
npx create-expo-app@latest myapp-s --template blank
```

**4. Implement Design**

Based on the Frame0 mockup, create the React Native components:

```typescript
// App.tsx
import React from 'react';
import { View, TextInput, TouchableOpacity, Text, Image } from 'react-native';

export default function LoginScreen() {
  return (
    <View style={styles.container}>
      {/* Header with logo - matches Frame0 design */}
      <View style={styles.header}>
        <Image source={require('./assets/logo.png')} style={styles.logo} />
        <Text style={styles.appName}>MyApp</Text>
      </View>

      {/* Email input - matches Frame0 design */}
      <TextInput
        style={styles.input}
        placeholder="Email address"
        placeholderTextColor="#9CA3AF"
      />

      {/* Password input */}
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#9CA3AF"
        secureTextEntry
      />

      {/* Login button - matches Frame0 design */}
      <TouchableOpacity style={styles.button}>
        <Text style={styles.buttonText}>Login</Text>
      </TouchableOpacity>

      {/* Links */}
      <Text style={styles.link}>Forgot password?</Text>
      <Text style={styles.link}>Sign up</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: '#2563EB',
    height: 120,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 48,
    height: 48,
  },
  appName: {
    fontSize: 32,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  input: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: 20,
    height: 48,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#2563EB',
    marginHorizontal: 20,
    marginTop: 24,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  link: {
    color: '#2563EB',
    textAlign: 'center',
    marginTop: 16,
    fontSize: 14,
  },
});
```

### Phase 3: Build and Test

**5. Build APK**

```bash
cd /home/samuel/sv/myapp-s
npm install
npx expo prebuild --platform android --no-install
cd android && ./gradlew assembleDebug
```

**6. Test on Firebase**

```bash
gcloud firebase test android run \
  --type robo \
  --app android/app/build/outputs/apk/debug/app-debug.apk \
  --device model=Pixel5,version=30 \
  --project=odin-mobile-lab
```

### Phase 4: Iterate

**7. Refine Design in Frame0**

Back in browser project:
```
Me: The login button needs more padding.
Make it 56px height instead of 48px.
Also, add a subtle shadow to the input fields.
```

**8. Update React Native Code**

Apply the design changes:
```typescript
input: {
  // ... existing styles
  height: 56,  // Updated from 48
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 4,
  elevation: 2,
}
```

**9. Rebuild and Retest**

```bash
cd android && ./gradlew assembleDebug
# Test again on Firebase
```

---

## Complete Example: E-commerce App

### Frame0 Design Session

**Request:**
```
Create a complete e-commerce app with 3 screens:

1. Home Screen:
   - Search bar at top
   - Category chips (Electronics, Fashion, Home)
   - Product grid (2 columns)
   - Bottom navigation (Home, Cart, Profile)

2. Product Detail:
   - Large product image
   - Product name and price
   - Size/color selectors
   - Add to Cart button
   - Product description

3. Cart Screen:
   - List of cart items with thumbnails
   - Quantity controls
   - Total price
   - Checkout button

Use a modern design with:
- Primary color: #10B981 (green)
- Background: #FFFFFF
- Text: #1F2937 (dark gray)
- Rounded corners throughout
```

### Frame0 Commands (Auto-executed)

```typescript
// Page 1: Home Screen
add_page({ name: "Home Screen" })
create_frame({ frameType: "phone", name: "Home" })

// Search bar
create_rectangle({
  name: "Search Bar",
  left: 16, top: 60,
  width: 361, height: 48,
  fillColor: "#F3F4F6",
  corners: [24, 24, 24, 24]
})
create_icon({ name: "search", left: 24, top: 68, size: "medium" })
create_text({ name: "Search Text", text: "Search products...", left: 56, top: 74 })

// Category chips
create_rectangle({ name: "Electronics Chip", left: 16, top: 120, width: 110, height: 40, fillColor: "#10B981", corners: [20, 20, 20, 20] })
create_text({ name: "Electronics", text: "Electronics", left: 24, top: 130, fontColor: "#FFFFFF" })
// ... repeat for other categories

// Product grid
create_rectangle({ name: "Product 1", left: 16, top: 180, width: 172, height: 240, fillColor: "#FFFFFF", corners: [12, 12, 12, 12] })
create_rectangle({ name: "Product Image 1", left: 24, top: 188, width: 156, height: 156, fillColor: "#F3F4F6", corners: [8, 8, 8, 8] })
create_text({ name: "Product Name 1", text: "Wireless Headphones", left: 24, top: 352, fontSize: 14 })
create_text({ name: "Product Price 1", text: "$99.99", left: 24, top: 372, fontSize: 16, fontColor: "#10B981" })
// ... repeat for product grid

// Bottom navigation
create_rectangle({ name: "Nav Bar", left: 0, top: 748, width: 393, height: 64, fillColor: "#FFFFFF" })
create_icon({ name: "home", left: 48, top: 764, size: "medium", strokeColor: "#10B981" })
create_icon({ name: "shopping-cart", left: 170, top: 764, size: "medium" })
create_icon({ name: "user", left: 292, top: 764, size: "medium" })

// Export
export_page_as_image({ format: "image/png" })

// Page 2: Product Detail
add_page({ name: "Product Detail" })
create_frame({ frameType: "phone", name: "Product Detail" })
// ... (product detail UI elements)

// Page 3: Cart
add_page({ name: "Cart Screen" })
create_frame({ frameType: "phone", name: "Cart" })
// ... (cart UI elements)
```

### Implementation Timeline

| Phase | Task | Time | Tool |
|-------|------|------|------|
| 1 | Design mockups in Frame0 | 30 min | Browser + Frame0 |
| 2 | Export designs as PNG | 2 min | Frame0 export |
| 3 | Create mobile project | 5 min | `mobile_create_project` |
| 4 | Implement screens in RN | 2-3 hours | Code editor |
| 5 | Build APK | 5 min | `mobile_build_android` |
| 6 | Test on Firebase | 10 min | `mobile_run_tests` |
| 7 | Iterate on design | 15 min | Frame0 + code |
| 8 | Final build & deploy | 10 min | CI/CD pipeline |

**Total:** ~4 hours from mockup to working app

---

## Best Practices

### Design in Frame0

1. **Start with phone frames** - Mobile-first design
2. **Use consistent spacing** - 8px, 16px, 24px grid
3. **Pick a color palette** - 3-5 colors max
4. **Use icons liberally** - `search_icons` for 1000+ options
5. **Export frequently** - Keep PNG references
6. **Create multiple pages** - One per screen

### Transition to Code

1. **Match exact dimensions** - Use Frame0 measurements
2. **Extract color codes** - Copy hex values directly
3. **Use same fonts** - System fonts or custom
4. **Replicate spacing** - padding/margin from Frame0
5. **Test on real devices** - Firebase Test Lab

### Iteration Loop

1. **Design change in Frame0** - Visual feedback
2. **Update code** - Apply changes
3. **Build APK** - Quick iteration (5 min)
4. **Test** - Verify on device
5. **Repeat** - Until perfect

---

## Integration with Mobile Platform

### Automatic Workflow

When you create a mobile project with Frame0 designs:

1. **Designs created** - Frame0 browser session
2. **Exported as PNG** - Reference images saved
3. **Project scaffolded** - `mobile_create_project`
4. **Code implemented** - Based on Frame0 specs
5. **Built automatically** - GitHub Actions CI/CD
6. **Tested automatically** - Firebase Test Lab
7. **Deployed** - TestFlight/Play Store

### Design Handoff Document

Frame0 can export design specs:

```
Me: Export the design specifications for this screen
```

Claude generates:
```markdown
# Login Screen Specifications

## Layout
- Screen size: 393 x 852 (iPhone 14 Pro)
- Safe area: 16px padding on sides

## Header
- Height: 120px
- Background: #2563EB (Blue)
- Border radius: 0 0 24px 24px

## Logo
- Size: 48 x 48px
- Position: Center, Y=40

## App Name
- Font size: 32px
- Font weight: Bold
- Color: #FFFFFF
- Position: Y=100

## Email Input
- Size: 353 x 48px
- Position: X=20, Y=160
- Background: #FFFFFF
- Border radius: 8px
- Placeholder: "Email address" (#9CA3AF)

... (complete specs)
```

---

## Advanced Features

### Component Library

Create reusable components in Frame0:

```
Me: Create a button component library with:
- Primary button (blue)
- Secondary button (gray)
- Danger button (red)
- Disabled state for each

Each button: 353x48px, 8px border radius
```

Frame0 creates a library page you can reference.

### Responsive Design

Design for multiple screen sizes:

```
Me: Create the home screen for:
1. Phone (393x852)
2. Tablet (820x1180)
3. Desktop (1440x900)

Adapt the layout for each size.
```

Frame0 creates 3 pages with responsive layouts.

### Design System

Build a complete design system:

```
Me: Create a design system page with:
- Color palette (swatches)
- Typography scale (H1-H6, body, caption)
- Spacing scale (4, 8, 16, 24, 32, 48px)
- Button variants
- Input field variants
- Icon set (commonly used)
```

Reference this across all screens.

---

## Troubleshooting

### Frame0 not available
- **Issue:** Tools don't work in CLI
- **Solution:** Use browser project (claude.ai)

### Designs look different on device
- **Issue:** Colors/sizes don't match
- **Solution:** Use exact hex codes and dp/px values

### Iteration takes too long
- **Issue:** Slow design → code → test cycle
- **Solution:** Use hot reload in Expo (`npx expo start`)

---

## Summary

**Frame0 + Mobile Platform = Rapid Prototyping**

1. Design in Frame0 (30 min)
2. Implement in React Native (2-3 hours)
3. Build & test automatically (15 min)
4. Iterate quickly (minutes per change)

**From idea to working app in <1 day.**

---

## Next Steps

1. **Try Frame0 in browser:** Open claude.ai → Select project → "Design a login screen"
2. **Export designs:** Get PNG references for implementation
3. **Create mobile project:** `mobile_create_project`
4. **Implement:** Code the designs
5. **Build:** `mobile_build_android`
6. **Test:** `mobile_run_tests` on Firebase
7. **Deploy:** Push to GitHub → Auto CI/CD

**Questions?** Ask for specific design patterns or implementation help!
