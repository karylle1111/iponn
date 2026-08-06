document.addEventListener('DOMContentLoaded', () => {
  const burgerToggle = document.getElementById('burger-toggle');
  const sideDrawer = document.getElementById('side-drawer');
  const navOverlay = document.getElementById('nav-overlay');
  const drawerClose = document.getElementById('drawer-close');
  const menuItems = document.querySelectorAll('.menu-item');
  const headerActionBtns = document.querySelectorAll('.nav-icon-btn');

  const savingsView = document.getElementById('savings-view');
  const blankView = document.getElementById('blank-view');
  const blankTitle = document.getElementById('blank-title');
  const blankDesc = document.getElementById('blank-desc');
  const currentViewLabel = document.getElementById('current-view-label');

  // Module Details Configuration for Blank Pages
  const viewDetails = {
    main: {
      title: "Main Page",
      desc: "Overall statistics, system metrics, and financial summaries will be displayed here."
    },
    savings: {
      title: "Savings Tracker",
      desc: "" // Rendered via embedded ipon.html
    },
    bills: {
      title: "Pay Bills Tracker",
      desc: "Monitor upcoming utilities, recurring bills, and payment deadlines."
    },
    expenses: {
      title: "Expenses Tracker",
      desc: "Track daily spending, categorize outgoings, and view budget insights."
    },
    profile: {
      title: "User Profile",
      desc: "Manage account settings, personal details, and user preferences."
    },
    notifications: {
      title: "Notifications",
      desc: "View recent system alerts, payment reminders, and status updates."
    },
    report: {
      title: "Report a Problem",
      desc: "Submit system bug reports, technical issues, or transaction errors."
    },
    feedback: {
      title: "Submit Feedback",
      desc: "Share your suggestions to help us improve the system experience."
    },
    contact: {
      title: "Contact Us",
      desc: "Reach out to support representatives or customer service."
    }
  };

  // Drawer Handlers
  const openDrawer = () => {
    sideDrawer.classList.add('open');
    navOverlay.classList.add('active');
  };

  const closeDrawer = () => {
    sideDrawer.classList.remove('open');
    navOverlay.classList.remove('active');
  };

  burgerToggle.addEventListener('click', openDrawer);
  drawerClose.addEventListener('click', closeDrawer);
  navOverlay.addEventListener('click', closeDrawer);

  // Switch Active View Function
  const switchView = (viewKey) => {
    const targetData = viewDetails[viewKey];
    if (!targetData) return;

    // Update Header Badge Text
    currentViewLabel.textContent = targetData.title;

    // Highlight menu items in drawer
    menuItems.forEach(item => {
      if (item.getAttribute('data-view') === viewKey) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Highlight header buttons if active
    headerActionBtns.forEach(btn => {
      if (btn.getAttribute('data-view') === viewKey) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Toggle Content Views
    if (viewKey === 'savings') {
      savingsView.classList.add('active');
      blankView.classList.remove('active');
    } else {
      savingsView.classList.remove('active');
      blankView.classList.add('active');
      blankTitle.textContent = targetData.title;
      blankDesc.textContent = targetData.desc;
    }

    closeDrawer();
  };

  // Event Listeners for Drawer Links
  menuItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const viewKey = item.getAttribute('data-view');
      switchView(viewKey);
    });
  });

  // Event Listeners for Header Buttons (Profile & Notifications)
  headerActionBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const viewKey = btn.getAttribute('data-view');
      switchView(viewKey);
    });
  });
});

    // Drawer & View Switching Script
    const burgerToggle = document.getElementById('burger-toggle');
    const sideDrawer = document.getElementById('side-drawer');
    const navOverlay = document.getElementById('nav-overlay');
    const drawerClose = document.getElementById('drawer-close');
    const menuItems = document.querySelectorAll('.menu-item, .nav-icon-btn');
    const viewContainers = document.querySelectorAll('.view-container');
    const currentViewLabel = document.getElementById('current-view-label');

    function toggleDrawer() {
      sideDrawer.classList.toggle('open');
      navOverlay.classList.toggle('active');
    }

    burgerToggle.addEventListener('click', toggleDrawer);
    drawerClose.addEventListener('click', toggleDrawer);
    navOverlay.addEventListener('click', toggleDrawer);

    menuItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const targetView = item.getAttribute('data-view');
        if (!targetView) return;

        viewContainers.forEach(container => container.classList.remove('active'));
        
        const activeContainer = document.getElementById(targetView + '-view');
        if (activeContainer) {
          activeContainer.classList.add('active');
        }

        document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
        if (item.classList.contains('menu-item')) {
          item.classList.add('active');
          currentViewLabel.textContent = item.textContent.trim();
        }

        if (sideDrawer.classList.contains('open')) {
          toggleDrawer();
        }
      });
    });