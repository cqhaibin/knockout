(function(undefined) {
    var componentLoadingOperationUniqueId = 0;
    var cahceComponents = {};

    ko.bindingHandlers['component'] = {
        'init': function(element, valueAccessor, ignored1, ignored2, bindingContext) {
            var currentViewModel,
                currentLoadingOperationId,
                afterRenderSub,
                disposeAssociatedComponentViewModel = function () {

                    //cache
                    if(cache){
                        ShowOrHiddenCacheComponent(cahceComponents[cacheId], false);
                        return;
                    }

                    var currentViewModelDispose = currentViewModel && currentViewModel['dispose'];
                    if (typeof currentViewModelDispose === 'function') {
                        currentViewModelDispose.call(currentViewModel);
                    }
                    if (afterRenderSub) {
                        afterRenderSub.dispose();
                    }
                    afterRenderSub = null;
                    currentViewModel = null;
                    // Any in-flight loading operation is no longer relevant, so make sure we ignore its completion
                    currentLoadingOperationId = null;
                },
                originalChildNodes = ko.utils.makeArray(ko.virtualElements.childNodes(element));
            var cache = element.getAttribute('cache') || false;
            var cacheId = null;
            if(cache){
                cacheId = "cacheid" + (new Date).getTime() + '' + Math.floor( Math.random() * 10000 );
                cahceComponents[cacheId] = {};
            }

            ko.virtualElements.emptyNode(element);
            ko.utils.domNodeDisposal.addDisposeCallback(element, disposeAssociatedComponentViewModel);

            ko.computed(function () {
                var value = ko.utils.unwrapObservable(valueAccessor()),
                    componentName, componentParams;

                if (typeof value === 'string') {
                    componentName = value;
                } else {
                    componentName = ko.utils.unwrapObservable(value['name']);
                    componentParams = ko.utils.unwrapObservable(value['params']);
                }

                if (!componentName) {
                    throw new Error('No component name specified');
                }

                var asyncContext = ko.bindingEvent.startPossiblyAsyncContentBinding(element, bindingContext);

                var loadingOperationId = currentLoadingOperationId = ++componentLoadingOperationUniqueId;
                ko.components.get(componentName, function(componentDefinition) {
                    // If this is not the current load operation for this element, ignore it.
                    if (currentLoadingOperationId !== loadingOperationId) {
                        return;
                    }

                    //cache
                    if(cache && cahceComponents[cacheId][componentName]){
                        ShowOrHiddenCacheComponent(cahceComponents[cacheId], true, componentName);
                        return;
                    }

                    // Clean up previous state
                    disposeAssociatedComponentViewModel();

                    // Instantiate and bind new component. Implicitly this cleans any old DOM nodes.
                    if (!componentDefinition) {
                        throw new Error('Unknown component \'' + componentName + '\'');
                    }
                    var wrapElement = cloneTemplateIntoElement(componentName, componentDefinition, element, cache);

                    var componentInfo = {
                        'element': element,
                        'templateNodes': originalChildNodes
                    };

                    var componentViewModel = createViewModel(componentDefinition, componentParams, componentInfo),
                        childBindingContext = asyncContext['createChildContext'](componentViewModel, {
                            'extend': function(ctx) {
                                ctx['$component'] = componentViewModel;
                                ctx['$componentTemplateNodes'] = originalChildNodes;
                            }
                        });

                    if (!cache && componentViewModel && componentViewModel['koDescendantsComplete']) {
                        afterRenderSub = ko.bindingEvent.subscribe(element, ko.bindingEvent.descendantsComplete, componentViewModel['koDescendantsComplete'], componentViewModel);
                    }

                    currentViewModel = componentViewModel;
                    if(cache){
                        cahceComponents[cacheId][componentName] = {
                            wrap: wrapElement,
                            view: currentViewModel
                        };
                        ko.applyBindingsToDescendants(childBindingContext, wrapElement, function(dom){
                            var keys = Object.getOwnPropertyNames(dom);
                            for(var i in keys){
                                var k = keys[i];
                                if(k.indexOf('__ko__')>= 0){
                                    setTimeout(function(){
                                        componentViewModel["koDescendantsComplete"].call(componentViewModel, wrapElement);
                                    },0);
                                }
                            }
                        });
                    }else{
                        ko.applyBindingsToDescendants(childBindingContext, element);
                    }
                });
            }, null, { disposeWhenNodeIsRemoved: element });

            return { 'controlsDescendantBindings': true };
        }
    };

    ko.virtualElements.allowedBindings['component'] = true;

    function ShowOrHiddenCacheComponent(allCache, checked, componentName){
        var keys = Object.getOwnPropertyNames(allCache);
        for(var i in keys){
            var k = keys[i];
            var item = allCache[k];
            if(checked && k == componentName){
                item.wrap.hidden = false;
            }else{
                item.wrap.hidden = true;
            }
        }
    }

    function cloneTemplateIntoElement(componentName, componentDefinition, element, isCache) {
        var template = componentDefinition['template'];
        if (!template) {
            throw new Error('Component \'' + componentName + '\' has no template');
        }

        var clonedNodesArray = ko.utils.cloneNodes(template);
        if(isCache){
            var wrap = document.createElement('div');
            element.appendChild(wrap);
            ko.virtualElements.setDomNodeChildren(wrap, clonedNodesArray);
            return wrap;
        }else{
            //not cache
            ko.virtualElements.setDomNodeChildren(element, clonedNodesArray);
            return null;
        }
    }

    function createViewModel(componentDefinition, componentParams, componentInfo) {
        var componentViewModelFactory = componentDefinition['createViewModel'];
        return componentViewModelFactory
            ? componentViewModelFactory.call(componentDefinition, componentParams, componentInfo)
            : componentParams; // Template-only component
    }

})();
