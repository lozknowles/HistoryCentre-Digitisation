from django.urls import path
from . import views

urlpatterns = [
    path('', views.record_list, name='record_list'),
    path('record/<int:pk>/', views.record_detail, name='record_detail'),
    path('record/new/', views.record_create, name='record_create'),
    path('record/<int:pk>/edit/', views.record_update, name='record_update'),
    path('record/<int:pk>/delete/', views.record_delete, name='record_delete'),
]
