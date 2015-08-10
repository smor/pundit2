angular.module('Pundit2.AnnotationSidebar')

.controller('AnnotationSidebarCtrl', function($scope, $filter, $document, $window, $timeout,
    EventDispatcher, AnnotationSidebar, AnnotationsExchange, Dashboard, Config, Analytics) {

    var bodyClasses = AnnotationSidebar.options.bodyExpandedClass + ' ' + AnnotationSidebar.options.bodyCollapsedClass;
    var sidebarClasses = AnnotationSidebar.options.sidebarExpandedClass + ' ' + AnnotationSidebar.options.sidebarCollapsedClass;

    // var html = angular.element('html');
    var body = angular.element('body');
    var container = angular.element('.pnd-annotation-sidebar-container');
    var header = angular.element('.pnd-annotation-sidebar-header');
    // var content = angular.element('.pnd-annotation-sidebar-content');

    var toolbarHeight = parseInt(angular.element('toolbar nav').css('height'), 10);

    var state = {
        toolbarHeight: toolbarHeight,
        newMarginTopSidebar: 0,
        sidebarCurrentHeight: 0,
        sidebarNewHeight: 0
    };

    var search = {
        iconMagnifier: AnnotationSidebar.options.inputIconSearch,
        iconFilter: AnnotationSidebar.options.inputIconFilter,
        clean: AnnotationSidebar.options.inputIconClear
    };

    var minDateWatch,
        maxDateWatch;

    var updateHitsTimer,
        annotationsCache = [];

    var savedOrEditedAnnotationQueque = [],
        deletedIdQueue = [];

    $scope.annotationSidebar = AnnotationSidebar;
    $scope.filters = AnnotationSidebar.getFilters();
    $scope.isAnnomaticActive = Config.isModuleActive('Annomatic');
    $scope.isAnnotationSidebarExpanded = AnnotationSidebar.options.isAnnotationSidebarExpanded;
    $scope.isLoadingData = false;
    $scope.isLoading = false;

    $scope.annotations = [];

    $scope.filterTypeExpanded = '';

    $scope.fromMinDate = new Date();
    $scope.toMinDate = new Date();
    $scope.fromMaxDate = new Date();
    $scope.fromToDate = new Date();

    body.css('position', 'static');
    container.css('height', body.innerHeight() + 'px');

    // Start reading the default
    if (AnnotationSidebar.options.isAnnotationSidebarExpanded) {
        body.addClass(AnnotationSidebar.options.bodyExpandedClass);
        container.addClass(AnnotationSidebar.options.sidebarExpandedClass);
    } else {
        body.addClass(AnnotationSidebar.options.bodyCollapsedClass);
        container.addClass(AnnotationSidebar.options.sidebarCollapsedClass);
    }

    var addAnnotations = function() {
        $timeout.cancel(updateHitsTimer);

        if (annotationsCache.length === 0) {
            return;
        }

        var currentHits = 0,
            maxHits = 20,
            delay = 200;

        updateHitsTimer = $timeout(function() {
            while (currentHits < maxHits && annotationsCache.length !== 0) {
                var currentAnnotation = annotationsCache.shift();
                $scope.annotations.push(currentAnnotation);

                currentHits++;
            }
            addAnnotations();
        }, delay);
    };

    var addAnnotation = function(annotation, sendEvent) {
        if (typeof $scope.allAnnotations[annotation.id] === 'undefined') {
            $scope.annotations.push(annotation);
            $scope.annotationsList[annotation.id] = annotation;
        }
        if (sendEvent) {
            EventDispatcher.sendEvent('AnnotationSidebar.updateAnnotation', annotation.id);
        }
    }

    var removeAnnotation = function(annotationId) {
        var currentIndex = $scope.annotations.map(function(e) {
            return e.id;
        }).indexOf(annotationId);
        if (currentIndex !== -1) {
            $scope.annotations.splice(currentIndex, 1);
            delete $scope.annotationsList[annotationId];
        }
    };

    // Annotation sidebar height
    var resizeSidebarHeight = function() {
        var minHeightSidebar = AnnotationSidebar.minHeightRequired;
        var bodyHeight = body.innerHeight();
        var documentHeight = $document.innerHeight();
        var difference;

        // TODO: save old documentHeight and reset the view
        state.sidebarNewHeight = Math.max(bodyHeight, documentHeight, minHeightSidebar);
        state.sidebarCurrentHeight = container.innerHeight();

        if (Dashboard.isDashboardVisible()) {
            difference = state.toolbarHeight + Dashboard.getContainerHeight();
        } else {
            difference = state.toolbarHeight;
        }

        state.sidebarNewHeight = state.sidebarNewHeight - difference;

        if (state.sidebarNewHeight !== state.sidebarCurrentHeight) {
            container.css('height', state.sidebarNewHeight + 'px');
        }
    };

    // Temp fix for bs-datepicker issues min value
    var setMin = function(currentMin) {
        var newMinDate = new Date((currentMin && !isNaN(Date.parse(currentMin))) ? Date.parse(currentMin) : 0);
        newMinDate.setDate(newMinDate.getDate() - 1);

        return $filter('date')(newMinDate, 'yyyy-MM-dd');
    };

    var updateMinDate = function(minDate) {
        if (typeof(minDate) !== 'undefined') {
            var newMinDate = $filter('date')(minDate, 'yyyy-MM-dd');
            $scope.fromMinDate = setMin(newMinDate);
            if (AnnotationSidebar.filters.fromDate.expression === '') {
                $scope.toMinDate = setMin(newMinDate);
            }
        }
    };

    var updateMaxDate = function(maxDate) {
        if (typeof(maxDate) !== 'undefined') {
            var newMaxDate = $filter('date')(maxDate, 'yyyy-MM-dd');
            $scope.toMaxDate = newMaxDate;
            if (AnnotationSidebar.filters.toDate.expression === '') {
                $scope.fromMaxDate = newMaxDate;
            }
        }
    };

    $scope.isSuggestionsPanelActive = function() {
        return AnnotationSidebar.isSuggestionsPanelActive();
    };
    $scope.activateSuggestionsPanel = function() {
        AnnotationSidebar.activateSuggestionsPanel();
    };

    $scope.isAnnotationsPanelActive = function() {
        return AnnotationSidebar.isAnnotationsPanelActive();
    };
    $scope.activateAnnotationsPanel = function() {
        AnnotationSidebar.activateAnnotationsPanel();
    };

    $scope.updateSearch = function(freeText) {
        AnnotationSidebar.filters.freeText.expression = freeText;
    };

    $scope.updateDate = function(date, fromTo) {
        var currentDate;
        if (typeof(date) !== 'undefined' && date !== null) {
            currentDate = date;
        } else {
            currentDate = fromTo === 'from' ? $scope.fromMinDate : $scope.toMaxDate;
        }

        if (fromTo === 'from') {
            $scope.toMinDate = setMin(currentDate);
        } else if (fromTo === 'to') {
            $scope.fromMaxDate = currentDate;
        }
    };

    $scope.isFilterLabelShowed = function(currentInputText) {
        if (typeof(currentInputText) === 'string') {
            return currentInputText.length > 0;
        }
    };

    $scope.toggleFilterList = function(event, filterType) {
        var pndFilterShowClass = 'pnd-annotation-sidebar-filter-show';
        var previousElement = angular.element('.' + pndFilterShowClass);
        var currentElement = angular.element(event.target.parentElement.parentElement);

        $scope.searchAuthors = '';
        $scope.searchNotebooks = '';
        $scope.searchTypes = '';
        $scope.searchPredicates = '';
        $scope.searchEntities = '';

        // Close all filter list and toggle the current
        previousElement.not(currentElement).removeClass(pndFilterShowClass);
        currentElement.toggleClass(pndFilterShowClass);

        if (currentElement.hasClass(pndFilterShowClass)) {
            $scope.filterTypeExpanded = filterType;

            if (filterType === 'date') {
                enableDateWatch();
            }
        } else {
            $scope.filterTypeExpanded = '';

            if (filterType === 'date') {
                disableDateWatch();
            }
        }

        // TODO this is not the right way to handle limit cases
        if (typeof filterType === 'undefined') {
            filterType = angular.element(event.target).text().trim();
        }
        Analytics.track('buttons', 'click', 'sidebar--filters--filtersPanel--' + filterType);
    };

    $scope.toggleFilter = function(currentFilter, currentUri) {
        var indexFilter = AnnotationSidebar.filters[currentFilter].expression.indexOf(currentUri);
        if (indexFilter === -1) {
            AnnotationSidebar.filters[currentFilter].expression.push(currentUri);
            AnnotationSidebar.toggleActiveFilter(currentFilter, currentUri);
        } else {
            AnnotationSidebar.filters[currentFilter].expression.splice(indexFilter, 1);
            AnnotationSidebar.toggleActiveFilter(currentFilter, currentUri);
        }
    };

    $scope.toggleBrokenAnnotations = function() {
        var trackingFilterLabel = '';
        if (AnnotationSidebar.filters.broken.expression === '') {
            AnnotationSidebar.filters.broken.expression = 'hideBroken';
            trackingFilterLabel = 'hideBroken';
        } else {
            AnnotationSidebar.filters.broken.expression = '';
            trackingFilterLabel = 'showBroken';
        }
        Analytics.track('buttons', 'click', 'sidebar--filters--filtersPanel--' + trackingFilterLabel);
    };

    $scope.setSearchIcon = function(str) {
        if (typeof(str) === 'undefined' || str === '') {
            return search.iconMagnifier;
        } else {
            return search.clean;
        }
    };

    $scope.setFilterIcon = function(str) {
        if (typeof(str) === 'undefined' || str === '') {
            return search.iconFilter;
        } else {
            return search.clean;
        }
    };

    EventDispatcher.addListener('Pundit.loading', function(e) {
        var currentState = e.args;
        if (currentState !== $scope.isLoadingData) {
            AnnotationSidebar.toggleLoading();
            $scope.isLoadingData = currentState;
        }
    });

    EventDispatcher.addListener('AnnotationSidebar.toggleLoading', function(e) {
        $scope.isLoading = e.args;
    });

    // Watch annotation sidebar expanded or collapsed
    EventDispatcher.addListener('AnnotationSidebar.toggle', function(e) {
        var currentState = e.args;
        if (currentState !== $scope.isAnnotationSidebarExpanded) {
            body.toggleClass(bodyClasses);
            container.toggleClass(sidebarClasses);

            AnnotationSidebar.setAnnotationsPosition();

            $scope.isAnnotationSidebarExpanded = currentState;
        }
    });

    // Watch filters expanded or collapsed
    EventDispatcher.addListener('AnnotationSidebar.toggleFiltersContent', function(e) {
        $scope.isFiltersShowed = e.args;
    });

    // Watch annotations
    $scope.$watch(function() {
        return AnnotationSidebar.getAllAnnotations();
    }, function(currentAnnotations) {
        var annotation, annotations, annotationsKey;

        if (AnnotationSidebar.needToFilter()) {
            annotations = AnnotationSidebar.getAllAnnotationsFiltered();
        } else {
            annotations = currentAnnotations;
        }

        annotationsKey = Object.keys(annotations);
        $scope.annotationsLength = annotationsKey.length;

        if (savedOrEditedAnnotationQueque.length > 0) {
            for (var i in savedOrEditedAnnotationQueque) {
                annotation = savedOrEditedAnnotationQueque[i];
                if (typeof annotations[annotation.id] !== 'undefined') {
                    addAnnotation(annotation, true);
                }
            }
            savedOrEditedAnnotationQueque = [];
        } else if (deletedIdQueue.length > 0) {
            for (var j in deletedIdQueue) {
                removeAnnotation(deletedIdQueue[j]);
            }
            deletedIdQueue = [];

            for (var a in $scope.annotations) {
                var annId = $scope.annotations[a].id;

                // has someone deleted one annotation in another session?
                if (typeof annotations[annId] === 'undefined') { 
                    removeAnnotation(annId);
                } else {
                    // Update annotation reference
                    $scope.annotations[a] = annotations[annId];
                }
            }

            angular.forEach(annotations, function(ann) {
                // has someone added one annotation in another session?
                if (typeof $scope.annotationsList[ann.id] === 'undefined') {
                    addAnnotation(ann, false);
                }
            });
        } else {
            annotationsCache = annotationsKey.map(function(k) {
                return annotations[k]
            });
            $scope.annotations = [];
            addAnnotations();
        }

        $scope.annotationsList = annotations;
        $scope.allAnnotations = currentAnnotations;
        $scope.allAnnotationsLength = Object.keys($scope.allAnnotations).length;
    });

    // Using JSON.strigify to avoid deep watch (, true) on AnnotationSidebar filters 
    $scope.$watch(function() {
        return JSON.stringify(AnnotationSidebar.filters);
    }, function(currentFilters) {
        if (AnnotationSidebar.filters.freeText.expression === '') {
            $scope.freeText = '';
        }
        if (AnnotationSidebar.filters.fromDate.expression === '' &&
            AnnotationSidebar.filters.toDate.expression === '') {
            updateMinDate(AnnotationSidebar.getMinDate());
            updateMaxDate(AnnotationSidebar.getMaxDate());
        }

        var annotations = AnnotationSidebar.getAllAnnotationsFiltered(),
            annotationsKey = Object.keys(annotations);
        annotationsCache = annotationsKey.map(function(k) {
            return annotations[k]
        });
        $scope.annotations = [];
        $scope.annotationsLength = annotationsKey.length;
        $scope.annotationsList = annotations;
        addAnnotations();
    });

    // Watch dashboard height for top of sidebar
    $scope.$watch(function() {
        return Dashboard.getContainerHeight();
    }, function(dashboardHeight) {
        state.newMarginTopSidebar = state.toolbarHeight + dashboardHeight;
        container.css('margin-top', state.newMarginTopSidebar + 'px');
        header.css('top', state.newMarginTopSidebar + 'px');
    });
    $scope.$watch(function() {
        return Dashboard.isDashboardVisible();
    }, function(dashboardVisibility) {
        if (dashboardVisibility) {
            state.newMarginTopSidebar = state.toolbarHeight + Dashboard.getContainerHeight();
            container.css('margin-top', state.newMarginTopSidebar + 'px');
            header.css('top', state.newMarginTopSidebar + 'px');
        } else {
            container.css('margin-top', state.toolbarHeight + 'px');
            header.css('top', state.toolbarHeight + 'px');
        }
    });

    $scope.$watch(function() {
        return AnnotationSidebar.minHeightRequired;
    }, function() {
        resizeSidebarHeight();
    });

    $scope.$watch(function() {
        return $document.innerHeight();
    }, function() {
        resizeSidebarHeight();
    });

    function enableDateWatch() {
        minDateWatch = $scope.$watch(function() {
            return AnnotationSidebar.getMinDate();
        }, function(minDate) {
            updateMinDate(minDate);
        });

        maxDateWatch = $scope.$watch(function() {
            return AnnotationSidebar.getMaxDate();
        }, function(maxDate) {
            updateMaxDate(maxDate);
        });
    }

    function disableDateWatch() {
        if (typeof minDateWatch === 'function') {
            minDateWatch();
            minDateWatch = undefined;
        }
        if (typeof maxDateWatch === 'function') {
            maxDateWatch();
            maxDateWatch = undefined;
        }
    }

    EventDispatcher.addListeners(['AnnotationsCommunication.saveAnnotation', 'AnnotationsCommunication.editAnnotation'], function(e) {
        var annotationId = e.args,
            currentAnnotation = AnnotationsExchange.getAnnotationById(annotationId);
        savedOrEditedAnnotationQueque.push(currentAnnotation);
    });

    EventDispatcher.addListeners(['AnnotationsCommunication.annotationDeleted'], function(e) {
        var annotationId = e.args;
        deletedIdQueue.push(annotationId);
    });

    angular.element($window).bind('resize', function() {
        resizeSidebarHeight();
    });

    AnnotationSidebar.log('Controller Run');
});