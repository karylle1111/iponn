document.addEventListener('DOMContentLoaded', () => {
  const burgerToggle = document.getElementById('burger-toggle');
  const sideDrawer = document.getElementById('side-drawer');
  const navOverlay = document.getElementById('nav-overlay');
  const drawerClose = document.getElementById('drawer-close');
  const menuItems = document.querySelectorAll('.menu-item');

  const savingsView = document.getElementById('savings-view');
  const blankView = document.getElementById('blank-view');
  const blankTitle = document.getElementById('blank-title');
  const blankDesc = document.getElementById('blank-desc');
  const currentViewLabel = document.getElementById('current-view-label');

  // Module Details Configuration for Blank Pages
  const viewDetails = {
    profile: {
      title: "User Profile",
      desc: "Manage account settings, user preferences, and security details."
    },
    savings: {
      title: "Savings Tracker",
      desc: "" // Handled via iframe
    },
    bills: {
      title: "Pay Bills Tracker",
      desc: "Monitor upcoming utilities, recurring bills, and payment deadlines."
    },
    expenses: {
      title: "Expenses Tracker",
      desc: "Track daily spending, categorize outgoings, and view budget insights."
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

  // Open Drawer
  const openDrawer = () => {
    sideDrawer.classList.add('open');
    navOverlay.classList.add('active');
  };

  // Close Drawer
  const closeDrawer = () => {
    sideDrawer.classList.remove('open');
    navOverlay.classList.remove('active');
  };

  burgerToggle.addEventListener('click', openDrawer);
  drawerClose.addEventListener('click', closeDrawer);
  navOverlay.addEventListener('click', closeDrawer);

  // Handle Navigation Item Selection
  menuItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();

      // Update active menu state
      menuItems.forEach(el => el.classList.remove('active'));
      item.classList.add('active');

      const viewKey = item.getAttribute('data-view');
      const targetData = viewDetails[viewKey];

      // Update Top Nav Subtitle Badge
      currentViewLabel.textContent = targetData.title;

      // Switch View Content
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
    });
  });
});